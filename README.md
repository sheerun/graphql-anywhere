# graphql-anywhere

Run a GraphQL query anywhere, without a GraphQL server or a schema. Just pass in one resolver. Use it together with [graphql-tag](https://github.com/apollostack/graphql-tag).

```
npm install graphql-anywhere graphql-tag
```

## Examples

Filter a nested object with a GraphQL query:

```js
import gql from 'graphql-tag';
import graphql from 'graphql-anywhere';

// I don't need all this stuff!
const gitHubAPIResponse = {
  "id": 1,
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

// Let's define a resolver that just returns a property
const resolver = (fieldName, root) => root[fieldName];









## What does this support?

Every GraphQL syntax feature I can think of is supported, as far as I know, including aliases, arguments, variables, inline fragments, named fragments, and `skip`/`include` directives.

### Known limitations:

- The execution engine is synchronous, so you probably shouldn't use this to query your API. But I'm accepting PRs to add promise functionality like `graphql-js` has!
