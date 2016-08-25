import {
  Document,
  SelectionSet,
  Field,
} from 'graphql';

import {
  getQueryDefinition,
  getFragmentDefinitions,
  createFragmentMap,
  FragmentMap,
} from './getFromAST';

import {
  shouldInclude,
} from './directives';

import {
  isField,
  isInlineFragment,
  resultKeyNameFromField,
  argumentsObjectFromField,
} from './storeUtils';

import isArray = require('lodash.isarray');
import isNull = require('lodash.isnull');
import assign = require('lodash.assign');

export type Resolver = (fieldName, rootValue, args, context) => any;

export type VariableMap = { [name: string]: any };

// Based on graphql function from graphql-js:
// graphql(
//   schema: GraphQLSchema,
//   requestString: string,
//   rootValue?: ?any,
//   contextValue?: ?any,
//   variableValues?: ?{[key: string]: any},
//   operationName?: ?string
// ): Promise<GraphQLResult>
export default function graphql(
  resolver: Resolver,
  document: Document,
  rootValue?: any,
  contextValue?: any,
  variableValues?: VariableMap
) {
  const queryDefinition = getQueryDefinition(document);

  const fragments = getFragmentDefinitions(document);
  const fragmentMap = createFragmentMap(fragments);

  return executeSelectionSet(
    resolver,
    queryDefinition.selectionSet,
    variableValues,
    fragmentMap,
    rootValue,
    contextValue
  );
}

const throwOnMissingField = true;

function executeSelectionSet(
  resolver: Resolver,
  selectionSet: SelectionSet,
  variables: VariableMap,
  fragmentMap: FragmentMap,
  rootValue: any,
  contextValue: any
) {
  if (!fragmentMap) {
    fragmentMap = {};
  }

  const result = {};

  // A map going from a typename to missing field errors thrown on that
  // typename. This data structure is needed to support union types. For example, if we have
  // a union type (Apple | Orange) and we only receive fields for fragments on
  // "Apple", that should not result in an error. But, if at least one of the fragments
  // for each of "Apple" and "Orange" is missing a field, that should return an error.
  // (i.e. with this approach, we manage to handle missing fields correctly even for
  // union types without any knowledge of the GraphQL schema).
  let fragmentErrors: { [typename: string]: Error } = {};

  selectionSet.selections.forEach((selection) => {
    const included = shouldInclude(selection, variables);

    if (isField(selection)) {
      const fieldResult = executeField(
        resolver,
        selection,
        variables,
        fragmentMap,
        included,
        rootValue,
        contextValue
      );

      const resultFieldKey = resultKeyNameFromField(selection);

      if (included && fieldResult !== undefined) {
        result[resultFieldKey] = fieldResult;
      }
    } else if (isInlineFragment(selection)) {
      const typename = selection.typeCondition.name.value;

      if (included) {
        try {
          const inlineFragmentResult = executeSelectionSet(
            resolver,
            selection.selectionSet,
            variables,
            fragmentMap,
            rootValue,
            contextValue
          );

          assign(result, inlineFragmentResult);

          if (!fragmentErrors[typename]) {
            fragmentErrors[typename] = null;
          }
        } catch (e) {
          if (e.extraInfo && e.extraInfo.isFieldError) {
            fragmentErrors[typename] = e;
          } else {
            throw e;
          }
        }
      }
    } else {
      // This is a named fragment
      const fragment = fragmentMap[selection.name.value];

      if (!fragment) {
        throw new Error(`No fragment named ${selection.name.value}`);
      }

      const typename = fragment.typeCondition.name.value;

      if (included) {
        try {
          const namedFragmentResult = executeSelectionSet(
            resolver,
            fragment.selectionSet,
            variables,
            fragmentMap,
            rootValue,
            contextValue
          );

          assign(result, namedFragmentResult);

          if (!fragmentErrors[typename]) {
            fragmentErrors[typename] = null;
          }
        } catch (e) {
          if (e.extraInfo && e.extraInfo.isFieldError) {
            fragmentErrors[typename] = e;
          } else {
            throw e;
          }
        }
      }
    }
  });

  if (throwOnMissingField) {
    handleFragmentErrors(fragmentErrors);
  }

  return result;
}

function executeField(
  resolver: Resolver,
  field: Field,
  variables: VariableMap,
  fragmentMap: FragmentMap,
  included: Boolean,
  rootValue: any,
  contextValue: any
): any {
  const fieldName = field.name.value;
  const args = argumentsObjectFromField(field, variables);

  const result = resolver(fieldName, rootValue, args, context);

  // Handle all scalar types here
  if (! field.selectionSet) {
    return result;
  }

  // From here down, the field has a selection set, which means it's trying to
  // query a GraphQLObjectType
  if (isNull(result)) {
    // Basically any field in a GraphQL response can be null
    return null;
  }

  if (isArray(result)) {
    return result.map((item) => {
      // XXX handle nested arrays

      // null value in array
      if (isNull(item)) {
        return null;
      }

      return executeSelectionSet(
        resolver,
        field.selectionSet,
        variables,
        fragmentMap,
        item,
        contextValue
      );
    });
  }

  // Returned value is an object, and the query has a sub-selection. Recurse.
  return executeSelectionSet(
    resolver,
    field.selectionSet,
    variables,
    fragmentMap,
    result,
    contextValue
  );
}

// Takes a map of errors for fragments of each type. If all of the types have
// thrown an error, this function will throw the error associated with one
// of the types.
export function handleFragmentErrors(fragmentErrors: { [typename: string]: Error }) {
  const typenames = Object.keys(fragmentErrors);

  // This is a no-op.
  if (typenames.length === 0) {
    return;
  }

  const errorTypes = typenames.filter((typename) => {
    return (fragmentErrors[typename] !== null);
  });

  if (errorTypes.length === Object.keys(fragmentErrors).length) {
    throw fragmentErrors[errorTypes[0]];
  }
}
