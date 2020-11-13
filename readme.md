## Lost-passports-to-BigQuery
Download files from open-data goverment site (https://data.gov.ua) and stream to Bigquery table.

### Download files
To start using script, you need to set `SOURCE_LINK` env variable in your terminal or by using `.env` file.
To download all files from page, simply type

`npm run download`

Also, you can process pages in a bulk. To do so, set `SOURCE_FILE` env variable. Repository contains [./sources.json](sources.json) sample file.

### Export to BQ
To export files, downloaded on previous step, type

`npm run export`

The folowing env options are required:

- `DATASET_NAME`
- `TABLE`: Name of table (Ensure, that table does not exists, otherwise it would be dropped with all contents)
- `PROJECT_ID`
- `BQ_AUTH_KEY_FILE`: JSON file with credentials (`PRIVATE_KEY`, `CLIENT_ID`, `CLIENT_EMAIL` env variables can be used instead)

### Other options
- `DATA_DIR`: Points to folder, where script will save data.
- `DROP_FILES`: While set to `1` (default behavior), the script will drop files before/after executing. Setting it to `0` will disable this feature.

