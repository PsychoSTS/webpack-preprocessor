Webpack Preprocessor
===================

Webpack plugin for preprocessor support

This project is my first attempt at making a webpack loader and is based on the webpack-strip-block project by jballant
<a href="https://github.com/jballant/webpack-strip-block">webpack-strip-block</a>

### JS Example:
```javascript
funcion foo() {
    // Multiple blocks of logical expressions
    /*#if dev*/
    let bar = 'dev';
    /*#elif stage&&test*/
    let bar = 'stage-test';
    /*#elif stage||test*/
    let bar = 'stage-or-test';
    /*#else*/
    let bar = 'prod';
    /*#endif*/

    // Unary operators
    /*#if !dev*/
    bar += '!dev';
    /*#endif*/
    
    /*#if cond1&&cond2||cond3 */ // <-- Any combination of && and || operators are now supported
    /*#endif*/

    console.log(bar);
}
```
### HTML Example:
``` html
<!--#if dev||stage-->
<div>DEVELOPMENT VERSION</div>
<!--#endif-->
```

### webpack.config:

```javascript
module: {
    rules: [
        { // webpack-preprocessor
            loader: 'webpack-preprocessor',
            options: {
                blocks: [
                    'stage',
                    'test'
                ]
            }
        }
    ]
}
```