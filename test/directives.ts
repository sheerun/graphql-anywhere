
import { assert } from 'chai';

import graphql from '../src';
import gql from 'graphql-tag';

describe('directives', () => {
  it('skips a field that has the skip directive', () => {
    const resolver = () => { throw new Error('should not be called'); };

    const query = gql`
      {
        a @skip(if: true)
      }
    `;

    const result = graphql(
      resolver,
      query,
      '',
      null,
      null,
    );

    assert.deepEqual(result, {});
  });

  it('includes info about arbitrary directives', () => {
    const resolver = (fieldName, root, args, context, info) => {
      const { doSomethingDifferent } = info.directives;
      let result = root[info.resultKey];
      if (doSomethingDifferent) {
        if (doSomethingDifferent.but.value === 'notTooCrazy') {
          return `${result} different`;
        } else {
          return `<<${result}>> incorrect directive arguments`;
        }
      }
      return result;
    };

    const input = {
      a: 'something',
    };

    const query = gql`
      {
        a @doSomethingDifferent(but: notTooCrazy)
        b
      }
    `;

    const result = graphql(
      resolver,
      query,
      input,
      null,
      null,
    );

    assert.deepEqual(result, { a: 'something different' });
  });
});
