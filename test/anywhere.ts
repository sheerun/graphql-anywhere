import { assert } from 'chai';

import graphql from '../src';
import gql from 'graphql-tag';

describe('graphql anywhere', () => {
  it('does basic things', () => {
    const resolver = (_, root) => root + 'fake';

    const query = gql`
      {
        a {
          b
          c
        }
      }
    `;

    const result = graphql(
      resolver,
      query,
      '',
      null,
      null
    );

    assert.deepEqual(result, {
      a: {
        b: 'fakefake',
        c: 'fakefake',
      },
    });
  });

  it('can traverse an object', () => {
    const obj = {
      a: {
        b: 'fun',
        c: ['also fun', 'also fun 2'],
        d: 'not fun',
      },
    };

    const resolver = (fieldName, root) => root[fieldName];

    const query = gql`
      {
        a {
          b
          c
        }
      }
    `;

    const result = graphql(
      resolver,
      query,
      obj,
      null,
      null
    );

    assert.deepEqual(result, {
      a: {
        b: 'fun',
        c: ['also fun', 'also fun 2'],
      },
    });
  });

  it('can use arguments, both inline and variables', () => {
    const resolver = (fieldName, _, args) => args;

    const query = gql`
      {
        inline(int: 5, float: 3.14, string: "string")
        variables(int: $int, float: $float, string: $string)
      }
    `;

    const variables = {
      int: 6,
      float: 6.28,
      string: 'varString',
    };

    const result = graphql(
      resolver,
      query,
      null,
      null,
      variables
    );

    assert.deepEqual(result, {
      inline: {
        int: 5,
        float: 3.14,
        string: 'string',
      },
      variables: {
        int: 6,
        float: 6.28,
        string: 'varString',
      },
    });
  });

  it('can use skip and include', () => {
    const resolver = (fieldName) => fieldName;

    const query = gql`
      {
        a {
          b @skip(if: true)
          c @include(if: true)
          d @skip(if: false)
          e @include(if: false)
        }
      }
    `;

    const result = graphql(
      resolver,
      query,
      null,
      null,
      null
    );

    assert.deepEqual(result, {
      a: {
        c: 'c',
        d: 'd',
      },
    });
  });

  it('can use inline and named fragments', () => {
    const resolver = (fieldName) => fieldName;

    const query = gql`
      {
        a {
          ... on Type {
            b
            c
          }
          ...deFrag
        }
      }

      fragment deFrag on Type {
        d
        e
      }
    `;

    const result = graphql(
      resolver,
      query,
      null,
      null,
      null
    );

    assert.deepEqual(result, {
      a: {
        b: 'b',
        c: 'c',
        d: 'd',
        e: 'e',
      },
    });
  });

  it('readme example', () => {
    // I don't need all this stuff!
    const gitHubAPIResponse = {
      'url': 'https://api.github.com/repos/octocat/Hello-World/issues/1347',
      'title': 'Found a bug',
      'body': 'I\'m having a problem with this.',
      'user': {
        'login': 'octocat',
        'avatar_url': 'https://github.com/images/error/octocat_happy.gif',
        'url': 'https://api.github.com/users/octocat',
      },
      'labels': [
        {
          'url': 'https://api.github.com/repos/octocat/Hello-World/labels/bug',
          'name': 'bug',
          'color': 'f29513',
        },
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
      'title': 'Found a bug',
      'user': {
        'login': 'octocat',
      },
      'labels': [
        {
          'name': 'bug',
        },
      ],
    });
  });

  it('readme example 2', () => {
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
  });
});
