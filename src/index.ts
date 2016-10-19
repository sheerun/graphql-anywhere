import {
  Document,
  SelectionSet,
  Field,
  FragmentDefinition,
  InlineFragment,
} from 'graphql';

import {
  getMainDefinition,
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

import isNull = require('lodash.isnull');
import isUndefined = require('lodash.isundefined');
import merge = require('lodash.merge');

export type Resolver = (
  fieldName: string,
  rootValue: any,
  args: any,
  context: any,
  info: ExecInfo
) => any;

export type VariableMap = { [name: string]: any };

export type ResultMapper = (values: {[fieldName: string]: any}, rootValue: any) => any;
export type FragmentMatcher = (rootValue: any, typeCondition: string, context: any) => boolean;

export type ExecContext = {
  fragmentMap: FragmentMap;
  contextValue: any;
  variableValues: VariableMap;
  resultMapper: ResultMapper;
  resolver: Resolver;
  fragmentMatcher: FragmentMatcher;
}

export type ExecInfo = {
  isLeaf: boolean;
  resultKey: string;
}

export type ExecOptions = {
  resultMapper?: ResultMapper;
  fragmentMatcher?: FragmentMatcher;
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
  execOptions: ExecOptions = {},
) {
  const mainDefinition = getMainDefinition(document);

  const fragments = getFragmentDefinitions(document);
  const fragmentMap = createFragmentMap(fragments) || {};

  const resultMapper = execOptions.resultMapper;

  // Default matcher always matches all fragments
  const fragmentMatcher = execOptions.fragmentMatcher || (() => true);

  const execContext: ExecContext = {
    fragmentMap,
    contextValue,
    variableValues,
    resultMapper,
    resolver,
    fragmentMatcher,
  };

  return executeSelectionSet(
    mainDefinition.selectionSet,
    rootValue,
    execContext
  );
}

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

  selectionSet.selections.forEach((selection) => {
    if (! shouldInclude(selection, variables)) {
      // Skip this entirely
      return;
    }

    if (isField(selection)) {
      const fieldResult = executeField(
        selection,
        rootValue,
        execContext
      );

      const resultFieldKey = resultKeyNameFromField(selection);

      if (fieldResult !== undefined) {
        result[resultFieldKey] = fieldResult;
      }
    } else {
      let fragment: InlineFragment | FragmentDefinition;

      if (isInlineFragment(selection)) {
        fragment = selection;
      } else {
        // This is a named fragment
        fragment = fragmentMap[selection.name.value];

        if (!fragment) {
          throw new Error(`No fragment named ${selection.name.value}`);
        }
      }

      const typeCondition = fragment.typeCondition.name.value;

      if (execContext.fragmentMatcher(rootValue, typeCondition, contextValue)) {
        const fragmentResult = executeSelectionSet(
          fragment.selectionSet,
          rootValue,
          execContext
        );

        merge(result, fragmentResult);
      }
    }
  });

  if (execContext.resultMapper) {
    return execContext.resultMapper(result, rootValue);
  }

  return result;
}

function executeField(
  field: Field,
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

  const info: ExecInfo = {
    isLeaf: ! field.selectionSet,
    resultKey: resultKeyNameFromField(field),
  };

  const result = resolver(fieldName, rootValue, args, contextValue, info);

  // Handle all scalar types here
  if (! field.selectionSet) {
    return result;
  }

  // From here down, the field has a selection set, which means it's trying to
  // query a GraphQLObjectType
  if (isNull(result) || isUndefined(result)) {
    // Basically any field in a GraphQL response can be null, or missing
    return result;
  }

  if (Array.isArray(result)) {
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
    // null value in array
    if (isNull(item)) {
      return null;
    }

    // This is a nested array, recurse
    if (Array.isArray(item)) {
      return executeSubSelectedArray(field, item, execContext);
    }

    // This is an object, run the selection set on it
    return executeSelectionSet(
      field.selectionSet,
      item,
      execContext
    );
  });
}
