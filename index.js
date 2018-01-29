const _ = require('lodash');
const jsep = require("jsep");
const loaderUtils = require('loader-utils');
const os = require('os');

let definitions;    // Holds the given definition flags
let EOLChar;        // Holds content EOL marker.

// Used regexes
const globalRegex = /(?:((?:\/[*]|<!--).*?(?:[*]\/|-->))|(.*?))*/gm;
const DIRECTIVE_REGEX = /(?:(?:(?:\/\*+)|(?:<!--))#)(if|elif|elseif|else)\s?(.+)?(?:(?:\*\/)|(?:-->))/gm;
const DIRECTIVE_END_REGEX = /((?:\/\*+|<!--)#)(endif)/;

// Consts
const IDENTIFIER = 'Identifier';
const LOGICAL_EXPRESSION = 'LogicalExpression';
const UNARY_EXPRESSION = 'UnaryExpression';
const OR = '||';
const AND = '&&';
const ELSE = 'else';

function parseLogicalExpression(expression) {

    let type = expression.type;

    if(type === IDENTIFIER){
        return definitions.indexOf(expression.name) > -1;
    }
    else if(type === UNARY_EXPRESSION){
        if(expression.operator !== '!') {
            console.error('Webpack Pre-Processor does not support unary operators other than the "!" operator.');
            return false;
        }

        return !parseLogicalExpression(expression.argument);
    }
    else if (type === LOGICAL_EXPRESSION) {

        let operator = expression.operator;
        let left = expression.left;
        let right = expression.right;

        let leftResult, rightResult;

        leftResult = parseLogicalExpression(left);
        rightResult = parseLogicalExpression(right);

        if(operator === OR){
            return leftResult || rightResult;
        }
        else if(operator === AND){
            return leftResult && rightResult;
        }
    }
}

function getDirectiveCode(branchRules, code = '') {

    let activeBranch = _.find(branchRules, rule => {
        if(rule.type === ELSE){
            return true;
        }
        else {
            return parseLogicalExpression(rule.expression);
        }
    });

    if (activeBranch) {
        return getCode(activeBranch.content);
    }
}

function getCode(rules, code = '') {
    let rule = rules.shift();

    if (!rule) {
        return code;
    }

    if (rule.type === 'expression' && rule.content) {
        code += EOLChar + rule.content;
    } else if (rule.type === 'directive') {
        code += getDirectiveCode(rule.content) || '';
    }

    return getCode(rules, code);
}

function setUp(content) {
    // Dynamically determine file end of line (EOL) marker.
    // Use os.EOL if no EOL marker found.
    // Note: ECMA 5.1 Specifications permits end slicing
    // on empty strings
    let lc = content.slice(-1);
    if (lc === '\n') {
        let slc = content.slice(-2);
        if (slc === '\r') {
            EOLChar = '\r\n';
        } else {
            EOLChar = '\n';
        }
    } else {
        // Unknown EOL marker, use current OS EOL instead.
        EOLChar = os.EOL;
    }

    // Trim removes EOL marker. Place after finding it.
    content.trim();
}

function getMatches(content) {
    let matches = content.match(globalRegex);
    // ignore empty matches
    matches = _.filter(matches, match => match && match.length);

    return matches;
}

function parseMatches(matches, stack = [{ content: [] }]) {
    let line = matches.shift();
    if(!line){
        return stack[0];
    }

    let target;
    let match;
    let directiveTokens;
    if(directiveTokens = DIRECTIVE_REGEX.exec(line)){

        // Remove the previous directive expression if it exists
        if(stack.length > 2){
            stack.shift();
        }
        // Create a directive for the directive expressions
        else if(stack.length === 1){
            target = stack[0];

            let directive = {
                type: 'directive',
                content: []
            }
            stack.unshift(directive);
            target.content.push(directive);
        }

        let directiveExpression = parseDirectiveExpression(line, directiveTokens);

        // Make the directive the active stack element
        target = stack[0];

        // Target must be the directive at this point
        target.content.push(directiveExpression);

        // New directive block
        stack.unshift(directiveExpression);
    }
    else if(line.match(DIRECTIVE_END_REGEX)){
        stack.shift(); // Remove directive from stack as we are now finnished with it
        stack.shift(); // Remove directive from stack as we are now finnished with it
    }
    else {
        target = stack[0];

        target.content.push({
            type: 'expression',
            content: line
        });
    }

    parseMatches(matches, stack);
    return stack;
}

function parseDirectiveExpression(line, tokens){

    // Remove directive start token (/**# | <!--#)
    tokens.shift();

    let type = tokens.shift();

    let expressionTree = null;
    if (type && type !== ELSE){
        expressionTree = jsep(tokens.shift());
    }

    return {
        type: type,
        expression: expressionTree,
        content: [],
        line: line
    };
}

function PreprocessorLoader(content) {

    let options = loaderUtils.getOptions(this);
    if (options && options.blocks) {
        definitions = options.blocks;
    }

    setUp(content);
    if (!content) {
        return content;
    }

    let matches = getMatches(content);
    if (!matches) {
        return content;
    }

    let expressions = parseMatches(matches);
    if(!expressions) {
        return content;
    }

    expressions = expressions.shift().content;
    let code = getCode(expressions);

    if (this.cacheable) {
        this.cacheable(true);
    }

    // Ensure modified code reconstitutes final EOL marker,
    // as trim function removes it. ESLint is one of many
    // programs to complain if final line EOL marker is
    // missing.
    content = code + EOLChar;

    return content;
}

module.exports = PreprocessorLoader;