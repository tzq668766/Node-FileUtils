var File = require ("../build/file-utils").File;
var UTIL = require ("util");

var create = function (cb){
	var finish = function (){
		i++;
		if (i === 7) cb ();
	};
	var i = 0;
	new File ("a/b/c").createDirectory (function (){
		new File ("a/b/c/c1.txt").createNewFile (finish);
		new File ("a/b/b1.txt").createNewFile (finish);
		new File ("a/b/b2.txt").createNewFile (finish);
		new File ("a/a1.txt").createNewFile (finish);
		new File ("a/a2.txt").createNewFile (finish);
		new File ("a/d/e/f").createDirectory (function (){
			new File ("a/d/e/e1.txt").createNewFile (finish);
			new File ("a/d/e/f/f1.txt").createNewFile (finish);
		});
	});
};

create (function (){
	var f = new File ("a");
	f.list (function (error, files){
		console.log ("All the content:");
		console.log (UTIL.inspect (files, false, null));
		
		/*
		Prints:
		
		{
			"a1.txt": "a\\a1.txt",
			"a2.txt": "a\\a2.txt",
			b: {
				"b1.txt": "a\\b\\b1.txt",
				"b2.txt": "a\\b\\b2.txt",
				c: {
					"c1.txt": "a\\b\\c\\c1.txt"
				}
			},
			d: {
				e: {
					"e1.txt": "a\\d\\e\\e1.txt",
					f: {
						"f1.txt": "a\\d\\e\\f\\f1.txt"
					}
				}
			}
		}
		*/
		
		//Synchronous filter
		var names = [];
		f.list (function (name, path){
			names.push (name);
			return true;
		}, function (error, files){
			console.log ("\nSynchronous filter:");
			console.log (names);
			//Prints: ["a1.txt", "a2.txt", "b", "d", "b1.txt", "b2.txt", "c", "e", "c1.txt", "e1.txt", "f", "f1.txt"]
			
			//Asynchronous filter
			f.list (function (name, path, ret){
				new File (path).isDirectory (function (error, isDirectory){
					if (error) return console.log (error);
					
					//We only want to save the directories
					ret (isDirectory);
				});
			}, function (error, files){
				if (error) return console.log (error);
				
				console.log ("\nAsynchronous filter:");
				console.log (files);
				
				/*
				Prints:
				
				{
					b: {
						c: {}
					},
					d: {
						e: {
							f: {}
						}
					}
				}
				*/
				
				//a: level 1
				//b, d: level 2
				//c, e: level 3
				//f: level 4
				//Deep = 2, therefore only the content of "a", "b" and "d" will be showed
				f.list (2, function (error, files){
					if (error) return console.log (error);
					
					console.log ("\nDeep = 2:");
					console.log (files);
					
					/*
					Prints:
					
					{
						"a1.txt": "a\\a1.txt",
						"a2.txt": "a\\a2.txt",
						b: {
							"b2.txt": "a\\b\\b2.txt",
							"b1.txt": "a\\b\\b1.txt",
							c: {}
						},
						d: {
							e: {}
						}
					}
					*/
					
					//Deep 2 with a synchronous/asynchronous filter
					//If we found a file named a1.txt we'll calculate its MD5 checksum and then
					//continue the listing
					f.list (function (name, path, ret){
						if (name === "a1.txt"){
							new File (path).checksum ("md5", "hex", function (error, checksum){
								if (error) return console.log (error);
								
								//Prints: a1.txt checksum: d41d8cd98f00b204e9800998ecf8427e
								console.log ("\n" + name + " checksum: " + checksum);
								
								//Asynchronous return
								ret (true);
							});
						}else{
							//Synchronous return
							return true;
						}
					}, 3, function (error, files){
						if (error) return console.log (error);
						
						console.log ("\nDeep = 2 with asynchronous filter:");
						console.log (files);
						
						/*
						Prints:
						
						{
							"a2.txt": "a\\a2.txt",
							b: {
								"b1.txt": "a\\b\\b1.txt",
								"b2.txt": "a\\b\\b2.txt",
								c: {
									"c1.txt": "a\\b\\c\\c1.txt"
								}
							},
							d: {
								e: {
									"e1.txt": "a\\d\\e\\e1.txt",
									f: {}
								},
								"d1.txt": "a\\d\\d1.txt"
							},
							"a1.txt": "a\\a1.txt"
						}
						*/
						
						f.remove ();
					});
				});
			});
		});
	});
});