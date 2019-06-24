# MyLibraryNYC Item Poster

This lambda currently listens to the AWS Bib/Item Kinesis Stream and sends POST requests to the MyLibraryNYC Rails application.

## Setup

1.  Run

```
npm install
npm install -g node-lambda
cp example.env .env
cp deploy.example.env deploy-item.env
```

1.  Fill in `.env` with amazon account information

1.  Fill in `deploy-*.env` files with the following variables

| Variable            | Value                     |
| :-------------      | :-------------            |
| NYPL_API_SCHEMA_URL | URL to item schema        |
| NYPL_POST_TYPE      | 'item'                    |
| NYPL_API_POST_URL   | URL this will POST to     |
| NYPL_OAUTH_URL      |                           |
| NYPL_OAUTH_KEY      |                           |
| NYPL_OAUTH_SECRET   |.                          |


Generate mock-data by running

```
node kinesify-data.js event.unencoded.sierra_item_post_request.json event.json https://platform.nypl.org/api/v0.1/current-schemas/Item
```

This will take the un-encoded data in `event.unencoded.sierra_item_post_request.json` and put it in a kinesis stream format using the avro schema.

Assuming you have the proper API and oauth credentials setup in your `.env`, you can run the lambda locally using the mock data in `event.json`

```
node-lambda run --configFile config/deploy_development.env
```

This will take `event.json` (which is mocked-up kinesis stream data) as input, authenticate with oauth server, retrieve schema from Schema API, parse stream data, then post it to the bib or item API depending on config.  `event.json` is the default file your lambda uses.  If you want to specify your own kinesified
mock data file, try `node-lambda run --configFile config/deploy_development.env --eventFile event.json`.

If you get a problem with node not finding one of the packages (can happen when incrementing the node version), run `node-lambda setup`.

## GIT Workflow

We follow a [feature-branch](https://www.atlassian.com/git/tutorials/comparing-workflows/feature-branch-workflow) workflow. Our branches, ordered from least-stable to most stable are:

| branch        | AWS account      |
|:--------------|:-----------------|
| `development` | nypl-sandbox     |
| `qa`          | nypl-digital-dev |
| `master`      | nypl-digital-dev |

If you need to introduce/update the application code, you `SHOULD`:

* Create feature branches off the `development` branch.
* Send a PR pointing to the `development` branch upon completion of feature branch.
* Once the PR is approved, it should be merged into the `development` branch.
* When a release is to be deployed, the `development` branch will be merged into `qa`.
* Upon feeling happy with the results in QA, merge `qa` into `master`.

## Deploy

Update event.json by running the above kinesify-data.js script for either item or bib.

Make sure you have the correct config/[bib|item]-[environment].env files. See config/deploy.example.env for an
example.  

Then run:

```
npm run deploy-[bib|item]-[development|qa|production]
```

Will deploy to Lambdas called `[bib|item]Poster-[environment]`. You can add a Kinesis stream triggers to execute function if not already added, but Kinesis stream triggers should be added automatically.
