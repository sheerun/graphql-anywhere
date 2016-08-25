# graphql-anywhere

[![npm version](https://badge.fury.io/js/graphql-anywhere.svg)](https://badge.fury.io/js/graphql-anywhere)

Run a GraphQL query anywhere, without a GraphQL server or a schema. Just pass in one resolver. Use it together with [graphql-tag](https://github.com/apollostack/graphql-tag).

```
npm install graphql-anywhere graphql-tag
```

This isn't necessarily meant to be a useful thing, but I think there are a lot of potentially exciting use cases for a completely standalone, schema-less, GraphQL execution engine. One of the best ones is if you're building a GraphQL client, and don't want to load graphql-js or a schema.

Let's come up with some more ideas - below are some use cases to get you started!

## Example: Filter a nested object

```js
import gql from 'graphql-tag';
import graphql from 'graphql-anywhere';

// I don't need all this stuff!
const gitHubAPIResponse = {
  "url": "https://api.github.com/repos/octocat/Hello-World/issues/1347",
  "title": "Found a bug",
  "body": "I'm having a problem with this.",
  "user": {
    "login": "octocat",
    "avatar_url": "https://github.com/images/error/octocat_happy.gif",
    "url": "https://api.github.com/users/octocat",
  },
  "labels": [
    {
      "url": "https://api.github.com/repos/octocat/Hello-World/labels/bug",
      "name": "bug",
      "color": "f29513"
    }
  ],
};

// Write a query that gets just the fields we want
const query = gql`
  {
    title
    user {
      login
    }
    labels {
      name
    }
  }
`;

// Define a resolver that just returns a property
const resolver = (fieldName, root) => root[fieldName];

// Filter the data!
const result = graphql(
  resolver,
  query,
  gitHubAPIResponse
);

assert.deepEqual(result, {
  "title": "Found a bug",
  "user": {
    "login": "octocat",
  },
  "labels": [
    {
      "name": "bug",
    }
  ],
});
```

## Example: Generate mock data

```js
// Write a query where the fields are types, but we alias them
const query = gql`
  {
    author {
      name: string
      age: int
      address {
        state: string
      }
    }
  }
`;

// Define a resolver that uses the field name to determine the type
// Note that we get the actual name, not the alias, but the alias
// is used to determine the location in the response
const resolver = (fieldName) => ({
  string: 'This is a string',
  int: 5,
}[fieldName]);

// Generate the object!
const result = graphql(
  resolver,
  query
);

assert.deepEqual(result, {
  author: {
    name: 'This is a string',
    age: 5,
    address: {
      state: 'This is a string',
    },
  },
});
```

## What does this support?

Every GraphQL syntax feature I can think of is supported, as far as I know, including aliases, arguments, variables, inline fragments, named fragments, and `skip`/`include` directives.

### Known limitations:

- The execution engine is synchronous, so you probably shouldn't use this to query your API. Please submit a PR to add promise functionality, and ideally batching support, like `graphql-js` has! Wouldn't it be cool if you could use this to dynamically query a REST API via GraphQL?
