# Javascript Client Code Generator For Swagger

Given a *swagger.json*-file, this project will allow you to generate an API client for it *at runtime*.

Note: the library is currently only intended to be used in the backend.

## How To Use

First, you need to generate the client. This step is described below

### Setup
You import it and call generate client:

```
const fs = require("fs");
const client = require("thisrepo").generateClient(JSON.parse(fs.readFileSync("swagger.json")));
```

### Performing API-calls
Once the client has been created you can call any endpoint described in your swagger spec.

For each endpoint there will be a corresponding method on the client-object. The name of each method
is the *"decamelized" operationId* of the corresponding endpoint. For example, an endpoint with the
operationId "getFoo" will yield a method "get_foo".

#### Parameters
There are different types of parameters that an endpoint might require.
- Query
- Body
- Path

Currently *all parameters are supplied the same way*, namely by passing them in as the first argument to
each endpoint's method.

For example, if the endpoint "getFoo" (mentioned above) required these three parameters:
- A Query-parameter "bar"
- A Body-parameter "baz"
- A Path-parameter "quux"

then it can (*must*, unless the parameters are optional) be invoked like so:

```
client.get_foo({bar: "mybar", baz: "mybaz", quux: 1234})
```

Note that, if you don't supply all required arguments an error will be returned explaining what is missing.
Likewise, if you supply extraneous arguments a similar error will be produced explaining what should be removed.

## Customizing the HTTP Agent

Sometimes a bit of fine-tuning can be required on the HTTP agent. A common example is that a custom HTTP header or
base path needs to be added to all requests. Since we rely on the npm *request*-library for issuing HTTP requests it
is possible to achieve this by first customizing the *request* "instance" that will be utilized by the swagger client.
Here is an example where we configure *request* to use "http://localhost:3000" as *base url*:

```
const fs = require("fs");
const request = require("request").defaults({baseUrl: "http://localhost:3000");
const client = require("thisrepo").generateClient(JSON.parse(fs.readFileSync("swagger.json")), request);
```

## Code Structure

The file *lib.js* contains the library code. It exports the function *generateClient()* which is the public API of the library.

The file *main.js* is an example application illustrating how the library can be used.