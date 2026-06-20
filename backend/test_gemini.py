import asyncio
from app.config import get_settings
from google import genai

async def test_stream():
    settings = get_settings()
    client = genai.Client(api_key=settings.gemini_api_key)
    try:
        # Check if generate_content_stream requires await
        print("Calling generate_content_stream...")
        # Let's try calling it without await first
        stream = client.aio.models.generate_content_stream(
            model='gemini-2.5-flash',
            contents='Hello, say test.'
        )
        print("Iterating stream...")
        async for chunk in stream:
            print("Chunk:", chunk.text)
    except Exception as e:
        print("Error without await:", e)
        try:
            print("Trying with await...")
            stream = await client.aio.models.generate_content_stream(
                model='gemini-2.5-flash',
                contents='Hello, say test.'
            )
            async for chunk in stream:
                print("Chunk:", chunk.text)
        except Exception as e2:
            print("Error with await:", type(e2), repr(str(e2)))
            err_msg = str(e2)
            print("'429' in err_msg:", '429' in err_msg)
            print("'Too Many Requests' in err_msg:", 'Too Many Requests' in err_msg)
            print("'RESOURCE_EXHAUSTED' in err_msg:", 'RESOURCE_EXHAUSTED' in err_msg)

if __name__ == "__main__":
    asyncio.run(test_stream())
