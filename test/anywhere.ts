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
});
