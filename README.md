# Description

This demo project wraps [ant-demo](https://github.com/ting-yun-career/antd-demo) in containerized docker app.

## Project strcture

- root
  - client: Ant Design Demo (import as a submodule)
  - server: Endpoint server

## Prerequsite

- Docker
- Node (LTS)
- Yarn

## Tested environment

- Windows

## Step to run the demo

1. run `yarn` under `client`
2. run `npm install` under `server`
3. run `docker-compose up` at root

Please make sure port 3000 and 4000 are not occupied prior to start.

## Step to run the endpoint test

run `npm test` under `server`

## Frontend Implementation

1. Login
2. Fetch items with token verification

## Endpoints

1. Login [POST]
2. Items [GET]

## Container Implemenation

1. Create React App (Port 3000)
2. Node.JS (Port 4000)
