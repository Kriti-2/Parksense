import pytest
from unittest.mock import AsyncMock, MagicMock, patch

def test_chat_endpoint_no_key(auth_client, monkeypatch):
    # Set empty API key to test failure response
    monkeypatch.setenv("GEMINI_API_KEY", "")
    from app.config import get_settings
    get_settings.cache_clear()
    
    import app.routes.chat
    app.routes.chat._genai_client = None
    
    response = auth_client.post("/chat/", json={"message": "Hello", "stream": False})
    assert response.status_code == 500
    assert "Gemini API Key is not configured." in response.json()["detail"]

def test_chat_endpoint_success(auth_client, monkeypatch):
    monkeypatch.setenv("GEMINI_API_KEY", "dummy-api-key")
    from app.config import get_settings
    get_settings.cache_clear()

    # Reset chat global cache
    import app.routes.chat
    app.routes.chat._genai_client = None
    app.routes.chat._dashboard_context_cache = {"text": "", "timestamp": 0.0}

    # Mock google.genai.Client
    mock_client = MagicMock()
    mock_response = MagicMock()
    mock_response.text = "This is a mocked assistant response."
    
    # client.aio.models.generate_content is an async method
    mock_generate = AsyncMock(return_value=mock_response)
    mock_client.aio.models.generate_content = mock_generate

    with patch("google.genai.Client", return_value=mock_client) as mock_client_class:
        response = auth_client.post("/chat/", json={"message": "How is congestion?", "stream": False, "context": "dashboard"})
        
        assert response.status_code == 200
        assert response.json() == {"response": "This is a mocked assistant response."}
        
        mock_client_class.assert_called_once_with(api_key="dummy-api-key")
        mock_generate.assert_called_once()
        # Verify the model used is gemini-2.5-flash
        call_kwargs = mock_generate.call_args[1]
        assert call_kwargs["model"] == "gemini-2.5-flash"
        assert "How is congestion?" in call_kwargs["contents"]
        # Dashboard context should contain active hotspots/alerts
        assert "LIVE DASHBOARD CONTEXT" in call_kwargs["contents"]

def test_chat_endpoint_login_context(auth_client, monkeypatch):
    monkeypatch.setenv("GEMINI_API_KEY", "dummy-api-key")
    from app.config import get_settings
    get_settings.cache_clear()

    # Reset chat global cache
    import app.routes.chat
    app.routes.chat._genai_client = None

    # Mock google.genai.Client
    mock_client = MagicMock()
    mock_response = MagicMock()
    mock_response.text = "Here is how to login."
    
    mock_generate = AsyncMock(return_value=mock_response)
    mock_client.aio.models.generate_content = mock_generate

    with patch("google.genai.Client", return_value=mock_client) as mock_client_class:
        response = auth_client.post("/chat/", json={"message": "How do I login?", "stream": False, "context": "login"})
        
        assert response.status_code == 200
        assert response.json() == {"response": "Here is how to login."}
        
        mock_client_class.assert_called_once_with(api_key="dummy-api-key")
        mock_generate.assert_called_once()
        
        call_kwargs = mock_generate.call_args[1]
        # Login context should contain public portal assistance guidance
        assert "मार्ग Sense Public Assistant" in call_kwargs["contents"]
        assert "How to login" in call_kwargs["contents"]
        # Ensure it does NOT contain sensitive officer/dashboard info
        assert "LIVE DASHBOARD CONTEXT" not in call_kwargs["contents"]

def test_chat_endpoint_streaming(auth_client, monkeypatch):
    monkeypatch.setenv("GEMINI_API_KEY", "dummy-api-key")
    from app.config import get_settings
    get_settings.cache_clear()

    # Reset chat global cache
    import app.routes.chat
    app.routes.chat._genai_client = None
    app.routes.chat._dashboard_context_cache = {"text": "", "timestamp": 0.0}

    # Mock google.genai.Client
    mock_client = MagicMock()
    
    async def mock_async_gen():
        chunk1 = MagicMock()
        chunk1.text = "This is "
        yield chunk1
        chunk2 = MagicMock()
        chunk2.text = "a streamed response."
        yield chunk2

    mock_generate_stream = AsyncMock(return_value=mock_async_gen())
    mock_client.aio.models.generate_content_stream = mock_generate_stream

    with patch("google.genai.Client", return_value=mock_client) as mock_client_class:
        response = auth_client.post("/chat/", json={"message": "Show me congestion", "stream": True})
        
        assert response.status_code == 200
        # The content should be plain text and streamed
        assert response.text == "This is a streamed response."
        
        mock_client_class.assert_called_once_with(api_key="dummy-api-key")
        mock_generate_stream.assert_called_once()
        call_kwargs = mock_generate_stream.call_args[1]
        assert call_kwargs["model"] == "gemini-2.5-flash"
        assert "Show me congestion" in call_kwargs["contents"]


