# Dataset

The Flipkart Gridlock hackathon violation CSV is **not included in this repository** (file exceeds GitHub's 100 MB limit).

## Setup

1. Download the dataset from the Flipkart Gridlock hackathon organizers.
2. Place the file at the project root:

```
margsense/jan to may police violation_anonymized791b166 (2).csv
```

3. Or set a custom path in `backend/.env`:

```
VIOLATIONS_CSV_PATH=../path/to/your/violations.csv
```

The backend falls back to seeded mock data if the CSV is not found.
