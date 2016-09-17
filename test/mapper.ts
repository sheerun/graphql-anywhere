import { assert } from 'chai';

import graphql from '../src';
import gql from 'graphql-tag';

import { cloneElement, createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import mapValues = require('lodash.mapvalues');

describe('result mapper', () => {
  it('can deal with promises', () => {
    const resolver = (_, root) => {
      return new Promise((res) => {
        setTimeout(() => {
          Promise.resolve(root).then(val => res(val + 'fake'));
        }, 10);
      });
    };

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

  it('can construct React elements', () => {
    const resolver = (fieldName, root, args) => {
      if (fieldName === 'text') {
        return args.value;
      }

      return createElement(fieldName, args);
    };

    const reactMapper = (childObj, root) => {
      const reactChildren = Object.keys(childObj).map(key => childObj[key]);

      if (root) {
        return cloneElement(root, root.props, ...reactChildren);
      }

      return reactChildren[0];
    };

    function gqlToReact(query): any {
      return graphql(
        resolver,
        query,
        '',
        null,
        null,
        reactMapper
      );
    }

    const query = gql`
      {
        div {
          s1: span(id: "my-id") {
            text(value: "This is text")
          }
          s2: span
        }
      }
    `;

    assert.equal(
      renderToStaticMarkup(gqlToReact(query)),
      '<div><span id="my-id">This is text</span><span></span></div>'
    );
  });

  it('can normalize data with the mapper', () => {
    function normalize(query, result) {
      const resolver = (fieldName, rootValue) => rootValue[fieldName];

      const store = {};

      const mapper = (childObj, rootValue) => {
        childObj = mapValues(childObj, (value) => {
          if (value.id) {
            return { $id: value.id };
          }

          return value;
        });

        if (childObj.id) {
          store[childObj.id] = childObj;
        }

        return childObj;
      };

      graphql(
        resolver,
        query,
        result,
        null,
        null,
        mapper
      );

      return store;
    }

    // Let's say we have unique IDs
    const nestedResult = {
      result: [{
        id: 1, title: 'Some Article',
        author: { id: 3, name: 'Dan' },
      }, {
        id: 2, title: 'Other Article',
        author: { id: 3, name: 'Dan' },
      }],
    };

    const graphQLQuery = gql`{
      result {
        id, title
        author { id, name }
      }
    }`;

    const store = normalize(graphQLQuery, nestedResult);

    assert.deepEqual(store, {
      1: { id: 1, title: 'Some Article', author: { $id: 3 } },
      2: { id: 2, title: 'Other Article', author: { $id: 3 } },
      3: { id: 3, name: 'Dan' },
    });
  });
});
