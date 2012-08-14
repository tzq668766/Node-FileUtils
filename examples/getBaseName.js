var File = require ("../build/file-utils").File;

console.log ("<" + new File ("test.js").getBaseName () + ">"); //Prints: <test>
console.log ("<" + new File (".js").getBaseName () + ">"); //Prints: <.js>
console.log ("<" + new File ("test.test.js").getBaseName () + ">"); //Prints: <test.test>
console.log ("<" + new File ("test...").getBaseName () + ">"); //Prints: <test...>
console.log ("<" + new File ("test.").getBaseName () + ">"); //Prints: <test.>
console.log ("<" + new File ("test").getBaseName () + ">"); //Prints: <test>
console.log ("<" + new File ("../a/b.c/d/e.f").getBaseName () + ">"); //Prints: <e>
console.log ("<" + new File ("").getBaseName () + ">"); //Prints: <> (empty string)