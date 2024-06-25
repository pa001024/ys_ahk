import { getIntrospectionQuery } from "graphql"
import fetch from "node-fetch" // or your preferred request in Node.js
import * as fs from "fs"

import { getIntrospectedSchema, minifyIntrospectionQuery } from "@urql/introspection"

fetch("http://localhost:8887/graphql", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
        variables: {},
        query: getIntrospectionQuery({ descriptions: false }),
    }),
})
    .then((result) => result.json())
    .then(({ data }: any) => {
        const minified = minifyIntrospectionQuery(getIntrospectedSchema(data))
        fs.writeFileSync("./src/schema.json", JSON.stringify(minified))
    })
