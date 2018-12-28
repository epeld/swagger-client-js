
const fs = require("fs");

const decamelize = require("decamelize");
const requestLib = require("request");
const _ = require("lodash");

const myswagger = JSON.parse(fs.readFileSync("swagger.json"));

const myreq = requestLib.defaults({baseUrl: 'http://localhost:3000'});

const checkType = (typeSpec, arg) => {
  if (_.isString(typeSpec)) {
    // Special case: arrays
    if (typeSpec === "array" && _.isArray(arg)) {
      return null;
    }
    if (typeof arg !== typeSpec) {
      return `Type mismatch. Expected ${typeSpec}. Was: ${typeof arg}`;
    }
  }
  return null;
};

const lookupSchema = (swagger, schemaRef) => {
  console.log(`Looking up ${schemaRef}`);
  const schema = _.get(swagger, schemaRef.replace(/#./,'').replace('/','.'));
  if (!schema || !(schema.properties || schema.enum)) {
    throw new Error(`Schema ref missing: ${schemaRef}`);
  }
  return schema;
};

const checkEnum = (schema, arg) => {
  if (_.includes(schema.enum, arg)) {
    return null;
  } else {
    return `Expected ${arg} to be one of ${schema.enum.join(', ')}`;
  }
};

const checkSchema = (swagger, schemaRef, arg) => {
  const schema = lookupSchema(swagger, schemaRef);
  if (_.has(schema, 'enum')) {
    const e = checkEnum(schema, arg);
    if (e) {
      return e;
    } else {
      return null;
    }
  }
  if (typeof arg !== "object") {
    return `Expected an object (${schemaRef})`;
  }
  const missing = _.filter(schema.required, f => !_.has(arg, f));
  if (missing.length) {
    return `Expected an object (${schemaRef}). But field(s) "${missing.join('", "')}" are missing`;
  }
  const errors = _.compact(
    _.map(
      Object.keys(arg),
      (f) => {
        if (!_.has(schema.properties, f)) {
          return `Superfluous field "${f}"`;
        }
        const field = arg[f];
        const spec = schema.properties[f];
        if (_.has(spec, 'type')) {
          const e = checkType(spec.type, field);
          if (e) {
            return `Field "${f}" type error: ${e}`;
          }
          if (spec.type === "array" && spec.items) {
            const errors2 = _.compact(
              _.map(field, (item, index) => {
                const e2 = checkEnum(spec.items, item);
                if (e2) {
                  return `element ${index} error: ${e2}`;
                } else {
                  return null;
                }
              })
            );
            if (errors2.length) {
              return `Field "${f}" item errors: ${errors2.join(', ')}"`;
            }
          }
        } else if (_.has(spec, '$ref')) {
          const ref = spec['$ref'];
          if (!ref) {
            throw new Error(`Bad $ref in field "${field}"`);
          }
          const e = checkSchema(swagger, ref, field);
          if (e) {
            return `Field "${f}" sub-schema error: ${e}`;
          }
        } else {
          return `Unknown field type ${schemaRef}:${f}`;
        }
        return null;
      }
    )
  );
  if (errors.length) {
    return errors.join("\n");
  } else {
    return null;
  }
};

const checkArg = (swagger, argSpec, arg) => {
  if (_.isUndefined(arg) && !argSpec.required) {
    return null;
  }
  if (argSpec.schema) {
    if (!argSpec.schema['$ref']) {
      throw new Error(`Bad schema ref in ${JSON.stringify(argSpec)}`);
    }
    return checkSchema(swagger, argSpec.schema['$ref'], arg);
  }
  if (argSpec.type) {
    return checkType(argSpec.type, arg);
  }
  return `Unsupported argument type '${argSpec.type}'`;
};

const httpClient = (req, request) => {
  const {method, args, path, spec, swagger} = req;
  const params = _.keyBy(spec.parameters, 'name');

  const optional = _.filter(spec.parameters, (spec) => !spec.required).map(spec => spec.name);

  const missing = _.difference(Object.keys(params), Object.keys(args), optional);
  const superfluous = _.difference(Object.keys(args), Object.keys(params));
  if (missing.length) {
    return Promise.reject(`Missing arguments: "${missing.join('", "')}"`);
  }
  if (superfluous.length) {
    return Promise.reject(`Superfluous arguments: "${superfluous.join('", "')}"`);
  }

  const errors = _.compact(_.map(spec.parameters, (p) => checkArg(swagger, p, args[p.name])));
  if (errors.length) {
    return Promise.reject(`Errors in arg list: ${errors.join('\n')}`);
  } else {
    // console.log('No argument Errors');
  }

  const bodyArgNames = _.filter(spec.parameters, (spec) => spec.in === "body").map(spec => spec.name);
  const pathArgNames = _.filter(spec.parameters, (spec) => spec.in === "path").map(spec => spec.name);
  const queryArgNames = _.filter(spec.parameters, (spec) => spec.in === "query").map(spec => spec.name);

  const bodyArgs = _.pick(args, bodyArgNames);
  const pathArgs = _.pick(args, pathArgNames);
  const queryArgs = _.pick(args, queryArgNames);

  const queryString = '?' + _.map(queryArgs, (v, k) => `${k}=${v}`).join('&');
  
  const url = path.split('/').map((part) => {
    const trimmed = _.trim(part);
    if (_.startsWith(trimmed, '{') &&
        _.endsWith(trimmed, '}')) {
      const argName = trimmed.substring(1, trimmed.length-1);
      if (!_.has(pathArgs, argName)) {
        throw new Error(`Internal error: missing path arg '${argName}'`);
      } else {
        return pathArgs[argName];
      }
    } else {
      return part;
    }
  }).join('/') + (queryArgNames.length ? queryString : '');

  console.log(`Constructed url '${url}', body: ${JSON.stringify(bodyArgs)}`);
  return new Promise((resolve, reject) => {
    request({url, method, form: bodyArgs}, (err, response, body) => {
      if (err) {
        reject(err);
      } else {
        if (_.has(spec, 'responses') && !_.includes(String(response.statusCode), spec.responses)) {
          console.error(`Status from (${method}) ${url} was ${response.statusCode} which is not in its list of responses`);
        }
        resolve(response);
      }
    });
  });
};

/**
 * Constructs a swagger client bound to the given "request-like"-object
 * (i.e, what you get back from calling request.defaults()).
 *
 * @param swagger this is the swagger JSON-structure
 * @param request (optional) the http client to use. See request.defaults
 */
const generateClient = (swagger, request) => {
  request = request || requestLib.defaults();
  const client = {};
  _.forEach(swagger.paths, (methods, path) => {
    _.forEach(methods, (spec, method) => {
      const {operationId} = spec;
      const name = decamelize(operationId);
      const f = function(args) {
        console.log(name, 'called with args:', JSON.stringify(args));
        const req = {
          method, args, path, spec, swagger
        };
        return httpClient(req, request);
      };
      client[name] = f;
      console.log(path, method, name);
    });
  });
  return client;
};


const client = generateClient(myswagger);
const x = {
  body: {
    externalId: "asd",
    start: {
      type: "sunrise"
    },
    dayOfWeek: []
  }
};
//client.create_timer(x).then(console.log).catch(console.error);
client.get_timer({timerId: "3", external: "true"}).then(console.log).catch(console.error);

// const x = {
//   externalId: "1",
//   start: {
//     type: "time"
//   },
//   dayOfWeek: ["Mon"]
// };
// const err = checkSchema(myswagger, '#/definitions/CreateTimerRequest', x);
// if (err) {
//   console.error('\nError:');
//   console.error(err);
// }
