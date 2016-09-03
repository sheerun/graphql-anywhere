import { assert } from 'chai';

import graphql from '../src';
import gql from 'graphql-tag';

describe('result mapper', () => {
  it('can deal with promises', () => {
    const resolver = (_, root) => Promise.resolve(root).then(val => val + 'fake');

    function promiseForObject(object): Promise<{[key: string]: any}> {
      const keys = Object.keys(object);
      const valuesAndPromises = keys.map(name => object[name]);

      return Promise.all(valuesAndPromises).then(
        values => values.reduce((resolvedObject, value, i) => {
          resolvedObject[keys[i]] = value;
          return resolvedObject;
        }, Object.create(null))
      );
    }

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
      null,
      promiseForObject
    );

    return result.then((value) => {
      assert.deepEqual(value, {
        a: {
          b: 'fakefake',
          c: 'fakefake',
        },
      });
    });
  });
});
