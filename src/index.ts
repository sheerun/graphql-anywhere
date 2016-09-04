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

export type ResultMapper = (values: {[fieldName: string]: any}, rootValue: any) => any;

export type ExecContext = {
  fragmentMap: FragmentMap;
  contextValue: any;
  variableValues: VariableMap;
  resultMapper: ResultMapper;
  resolver: Resolver;
}

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
  variableValues?: VariableMap,
  resultMapper?: ResultMapper
) {
  const queryDefinition = getQueryDefinition(document);

  const fragments = getFragmentDefinitions(document);
  const fragmentMap = createFragmentMap(fragments) || {};

  const execContext: ExecContext = {
    fragmentMap,
    contextValue,
    variableValues,
    resultMapper,
    resolver,
  };

  return executeSelectionSet(
    queryDefinition.selectionSet,
    rootValue,
    execContext
  );
}

const throwOnMissingField = true;

function executeSelectionSet(
  selectionSet: SelectionSet,
  rootValue: any,
  execContext: ExecContext
) {
  const {
    fragmentMap,
    contextValue,
    variableValues: variables,
  } = execContext;

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
        selection,
        included,
        rootValue,
        execContext
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
            selection.selectionSet,
            rootValue,
            execContext
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
            fragment.selectionSet,
            rootValue,
            execContext
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

  if (execContext.resultMapper) {
    return execContext.resultMapper(result, rootValue);
  }

  return result;
}

function executeField(
  field: Field,
  included: Boolean,
  rootValue: any,
  execContext: ExecContext
): any {
  const {
    variableValues: variables,
    contextValue,
    resolver,
  } = execContext;

  const fieldName = field.name.value;
  const args = argumentsObjectFromField(field, variables);

  const result = resolver(fieldName, rootValue, args, contextValue);

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
    return executeSubSelectedArray(field, result, execContext);
  }

  // Returned value is an object, and the query has a sub-selection. Recurse.
  return executeSelectionSet(
    field.selectionSet,
    result,
    execContext
  );
}

function executeSubSelectedArray(
  field,
  result,
  execContext
) {
  return result.map((item) => {
    // XXX handle nested arrays

    // null value in array
    if (isNull(item)) {
      return null;
    }

    if (isArray(item)) {
      return executeSubSelectedArray(field, item, execContext);
    }

    return executeSelectionSet(
      field.selectionSet,
      item,
      execContext
    );
  });
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
