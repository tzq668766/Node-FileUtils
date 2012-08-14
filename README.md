<a name="start"></a>

Node FileUtils
==============

#### File and directory utilities for node.js ####

[Show me!](#showme) | [Availability](#availability) | [Compatibility](#compatibility) | [Documentation](#documentation)

Version: 0.2.1

The library provides the typical file and directory utilities found in Java JDK and Java FileUtils library.
It also has a security layer to prevent unwanted operations. All the functions are asynchronous.

<a name="showme"></a>
#### Show me! [↑](#start) ####

```javascript
var File = require ("file-utils").File;

var settings = {
	prefix: "foo",
	suffix: "bar",
	directory: "."
};

File.createTempFile (settings, function (error, file){
	console.log (file.getPath ()); //Prints: foo<random number>bar
});
```

***

<a name="availability"></a>
#### Availability [↑](#start) ####

Via npm:

```
npm install file-utils
```

***

<a name="compatibility"></a>
#### Compatibility [↑](#start) ####

✔ Node 0.1.7+

***

<a name="documentation"></a>
#### Documentation [↑](#start) ####
 
[Reference](https://github.com/Gagle/Node-FileUtils/wiki/Reference)  
[Examples](https://github.com/Gagle/Node-FileUtils/tree/master/examples)  
[Change Log](https://github.com/Gagle/Node-FileUtils/wiki/Change-Log)  
[MIT License](https://github.com/Gagle/Node-FileUtils/blob/master/LICENSE)