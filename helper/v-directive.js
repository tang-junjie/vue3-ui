'use strict'

// Todo: Could make AST-prevention attribute specific

const utils = require('eslint-plugin-vue/lib/utils')

module.exports = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Report undesired content within `v` directives',
      // categories: ['vue3-essential', 'essential'],
      url: 'https://vue3.dev/rules/v-declarative.html',
    },
    fixable: null,
    schema: [
      {
        additionalProperties: false,
        properties: {
          safe: {
            type: 'array',
            items: {
              type: 'string',
            },
          },
          unsafe: {
            type: 'array',
            items: {
              type: 'string',
            },
          },
        },
      },
    ],
  },
  /** @param {RuleContext} context */
  create(context) {
    const {
      safe = [
        'Identifier',
        'Literal',
        // This only allows the inner template elements; one can still
        //   block `TemplateLiteral`
        'TemplateElement',
      ],
      unsafe = [
        // These just add a single operator, so not blocked by default
        // 'SpreadElement',
        // 'UnaryExpression',

        // This can have design features so not blocking by default
        // 'TemplateLiteral',

        // To avoid these, one can use a call expression
        'AssignmentExpression',
        'BinaryExpression',
        'LogicalExpression',
        'ConditionalExpression',
      ],
      unsafeNested = ['CallExpression'],
    } = context.options[0] || {}

    return utils.defineTemplateBodyVisitor(context, {
      /** @param {VDirective} node */
      'VAttribute[directive=true]'(node) {
        const { value } = node
        if (!value) {
          // console.log('null value', node)
          return
        }
        if (value.type !== 'VExpressionContainer') {
          // eslint-disable-next-line no-console -- Report unexpected
          console.log('Unexpected non-container', value)
          return
        }
        if (!value.expression) {
          // eslint-disable-next-line no-console -- Report unexpected
          console.log('Unexpected missing expression', value)
          return
        }
        const { expression } = value
        const { type, body } = expression
        if (safe.includes(type)) {
          return
        }
        if (type === 'VOnExpression') {
          const [bdy] = body
          if (bdy.type !== 'ExpressionStatement') {
            // eslint-disable-next-line no-console -- Report unexpected
            console.log('Unexpected non-expression', bdy)
            return
          }
          if (safe.includes(bdy.expression.type)) {
            return
          }
          checkBranches(bdy.expression, true)
          return
        }

        checkBranches(expression, true)

        function checkBranches(nde, rootCheck) {
          if (!nde) {
            return
          }
          const { type: typ } = nde
          if (safe.includes(typ)) {
            return
          }
          if (unsafe.includes(typ)) {
            report(nde)
          }
          if (!rootCheck && unsafeNested.includes(typ)) {
            report(nde, true)
          }
          switch (typ) {
            case 'VForExpression':
              nde.left.forEach(left => {
                checkBranches(left)
              })
              // Treat as root
              checkBranches(nde.right, rootCheck)
              return
            case 'MemberExpression':
              checkBranches(nde.object)
              checkBranches(nde.propery)
              return
            case 'ConditionalExpression':
              checkBranches(nde.test)
              checkBranches(nde.consequent)
              checkBranches(nde.alternate)
              return
            case 'AssignmentExpression':
            case 'BinaryExpression':
            case 'LogicalExpression':
              checkBranches(nde.left)
              checkBranches(nde.right)
              return
            case 'SpreadElement':
            case 'UnaryExpression':
              checkBranches(nde.argument)
              return
            case 'TemplateLiteral':
              nde.expressions.forEach(expr => {
                checkBranches(expr)
              })
              nde.quasis.forEach(quasi => {
                checkBranches(quasi)
              })
              return
            case 'ArrayExpression':
              nde.elements.forEach(element => {
                checkBranches(element)
              })
              return
            case 'ObjectExpression':
              nde.properties.forEach(property => {
                checkBranches(property)
              })
              return
            case 'Property':
              checkBranches(nde.key)
              checkBranches(nde.value)
              return
            case 'CallExpression':
              checkBranches(nde.callee)
              nde.arguments.forEach(arg => {
                checkBranches(arg)
              })
              return
            default:
              report(nde)
          }
        }

        // const element = node.parent.parent

        function report(nde, nested) {
          context.report({
            node: nde,
            loc: nde.loc,
            message: nested
              ? `Attribute "${node.key.name.rawName}" has bad nested type: ${nde.type}`
              : `Attribute "${node.key.name.rawName}" has bad type: ${nde.type}`,
          })
        }
      },
    })
  },
}
