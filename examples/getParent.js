var File = require ("../build/file-utils").File;

console.log (new File ("a/b/c").getParent ()); //Prints: a/b
console.log (new File ("./a").getParent ()); //Prints: null
console.log (new File ("../a").getParent ()); //Prints: ..
console.log (new File ("D:/a/b").getParent ()); //Prints: D:/a
console.log (new File ("D:/a").getParent ()); //Prints: D:
console.log (new File ("D:./a").getParent ()); //Prints: null
console.log (new File ("D:").getParent ()); //Prints: null