<!-- START doctoc generated TOC please keep comment here to allow auto update -->
<!-- DON'T EDIT THIS SECTION, INSTEAD RE-RUN doctoc TO UPDATE -->
## Table of Contents

- [Getting started on development](#getting-started-on-development)
    - [Prerequisites](#prerequisites)
    - [Libraries used](#libraries-used)
    - [Setup](#setup)
    - [Running the app in development mode](#running-the-app-in-development-mode)
        - [Running using Docker Compose](#running-using-docker-compose)
- [How do I code X?](#how-do-i-code-x)
    - [How do I create a new Mongoose/MongoDB schema?](#how-do-i-create-a-new-mongoosemongodb-schema)
    - [How do I create the REST API endpoints for a Mongoose/MongoDB schema?](#how-do-i-create-the-rest-api-endpoints-for-a-mongoosemongodb-schema)
- [Miscellaneous](#miscellaneous)
    - [Other development tools](#other-development-tools)

<!-- END doctoc generated TOC please keep comment here to allow auto update -->


## Getting started on development

### Prerequisites

- Node v10+
- Git
- MongoDB (can be installed via Docker)

Optional:

- Docker and Docker Compose
  - Setup is straightforward for Linux and macOS
  - For Windows:
    - Docker: https://docs.docker.com/docker-for-windows/
    - Docker Compose: https://docs.docker.com/compose/install/ (click on Windows tab)

For testing the API:

- Postman - GUI REST API client (https://www.getpostman.com/)
- cURL - Built-in to Linux and macOS

### Libraries used

- `dotenv` - Loads environment variables from a `.env` file into `process.env`
- `express` - Lightweight web framework for Node.js
- `mongoose` - Used to write schemas for MongoDB in JSON
- `express-restify-mongoose` - Used to automatically generate the REST API endpoints from Mongoose schema
  - Docs: https://florianholzapfel.github.io/express-restify-mongoose/

### Setup

1. Checkout the code (choose one of HTTPS or SSH):
    - Via HTTPS: `git clone https://github.com/necramirez/slack-mafiascummod.git`
    - Via SSH: `git clone git@github.com:necramirez/slack-mafiascummod.git`
2. Change working directory: `cd slack-mafiascummod`
3. Install dependencies: `npm install`
4. Create a local environment config file: `cp .env.sample .env`
    - Edit `.env` and provide a valid MongoDB URI to the variable `MONGODB_URI`

### Running the app in development mode

```sh
npm run start:dev
```

#### (Alternative) Running using Docker Compose

```sh
docker-compose up
```

Access the API at http://localhost:3000

While running in development mode, any changes in `*.js` files will be detected and will automatically restart the Node.js process.


## How do I code X?

### How do I create a new Mongoose/MongoDB schema?

- Create the Mongoose schema file in the `models/` directory
- Preferred naming conventions:
  - filename in camelCase
  - schema and model name in PascalCase

Example:

```js
const { connection: db, Schema } = require('../services/mongoose');

const AnnouncementSchema = new Schema(
  {
    title: {
      type: String,
      required: true,
    },
    content: {
      type: String,
      required: true,
    },
    createdBy: {
      type: String,
      required: true,
    },
  },
  {
    timestamps: true,
  },
);

module.exports = db.model('Announcement', AnnouncementSchema);
```

### How do I create the REST API endpoints for a Mongoose/MongoDB schema?

- Edit `api/index.js`
- Import the model:

```js
const User = require('../models/user');
```

- Setup the router:

```js
restify.serve(router, User);
```


## Miscellaneous

### Other development tools

Some tools to help with "developer experience" a.k.a. DX:

- EditorConfig
- ESLint
- Prettier

Recommended editors (and their plugins):

- Sublime Text 3
  - All Autocomplete - Allows auto-completion from all open files; by default, Sublime Text only looks at the current file
  - EditorConfig - To consume the `.editorconfig` file
  - GitGutter - To mark line changes in the editor gutter
  - SublimeLinter
    - SublimeLinter-eslint

- Visual Studio Code
  - EditorConfig for VS Code
