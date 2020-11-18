## Lost-passports-to-BigQuery
Stream contents from open-data goverment site (https://data.gov.ua) to Bigquery table.

### Usage
To make export, type

`npm run export`

The folowing env options are required:

- `DATASET_NAME`
- `TABLE`: Name of table (Ensure, that table does not exists, otherwise it would be dropped with all contents)
- `PROJECT_ID`
- `BQ_AUTH_KEY_FILE`: JSON file with credentials (`PRIVATE_KEY`, `CLIENT_ID`, `CLIENT_EMAIL` env variables can be used instead)
- `SOURCE_ID`: Target dataset identifier at https://data.gov.ua site