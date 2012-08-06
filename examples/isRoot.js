var File = require ("../build/file-utils").File;

console.log (new File ("D:").isRoot ()); //Prints: false, it's the same as D:. or .
console.log (new File ("D:/").isRoot ()); //Prints: true
console.log (new File ("D:/a").isRoot ()); //Prints: false
console.log (new File ("D:/a/").isRoot ()); //Prints: false