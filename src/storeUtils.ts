import {
  Field,
  IntValue,
  FloatValue,
  StringValue,
  BooleanValue,
  ObjectValue,
  ListValue,
  EnumValue,
  Variable,
  InlineFragment,
  Value,
  Selection,
  GraphQLResult,
  Name,
} from 'graphql';

import includes = require('lodash.includes');

type ScalarValue = StringValue | BooleanValue | EnumValue;

function isScalarValue(value: Value): value is ScalarValue {
  const SCALAR_TYPES = ['StringValue', 'BooleanValue', 'EnumValue'];
  return includes(SCALAR_TYPES, value.kind);
}

type NumberValue = IntValue | FloatValue;

function isNumberValue(value: Value): value is NumberValue {
  const NUMBER_TYPES = ['IntValue', 'FloatValue'];
  return includes(NUMBER_TYPES, value.kind);
}

function isVariable(value: Value): value is Variable {
  return value.kind === 'Variable';
}

function isObject(value: Value): value is ObjectValue {
  return value.kind === 'ObjectValue';
}

function isList(value: Value): value is ListValue {
  return value.kind === 'ListValue';
}

function valueToObjectRepresentation(argObj: any, name: Name, value: Value, variables?: Object) {
  if (isNumberValue(value)) {
    argObj[name.value] = Number(value.value);
  } else if (isScalarValue(value)) {
    argObj[name.value] = value.value;
  } else if (isObject(value)) {
    const nestedArgObj = {};
    value.fields.map((obj) => valueToObjectRepresentation(nestedArgObj, obj.name, obj.value, variables));
    argObj[name.value] = nestedArgObj;
  } else if (isVariable(value)) {
    if (! variables || !(value.name.value in variables)) {
      throw new Error(`The inline argument "${value.name.value}" is expected as a variable but was not provided.`);
    }
    const variableValue = variables[value.name.value];
    argObj[name.value] = variableValue;
  } else if (isList(value)) {
    argObj[name.value] = value.values.map((listValue) => {
      const nestedArgArrayObj = {};
      valueToObjectRepresentation(nestedArgArrayObj, name, listValue, variables);
      return nestedArgArrayObj[name.value];
    });
  } else {
    // There are no other types of values we know of, but some might be added later and we want
    // to have a nice error for that case.
    throw new Error(`The inline argument "${name.value}" of kind "${(value as any).kind}" is not \
supported. Use variables instead of inline arguments to overcome this limitation.`);
  }
}

export function argumentsObjectFromField(field: Field, variables: Object): Object {
  if (field.arguments && field.arguments.length) {
    const argObj: Object = {};
    field.arguments.forEach(({name, value}) => valueToObjectRepresentation(
      argObj, name, value, variables));
    return argObj;
  }

  return null;
}

export function resultKeyNameFromField(field: Field): string {
  return field.alias ?
    field.alias.value :
    field.name.value;
}

export function isField(selection: Selection): selection is Field {
  return selection.kind === 'Field';
}

export function isInlineFragment(selection: Selection): selection is InlineFragment {
  return selection.kind === 'InlineFragment';
}

export function graphQLResultHasError(result: GraphQLResult) {
  return result.errors && result.errors.length;
}
