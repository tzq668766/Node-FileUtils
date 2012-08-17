/**
 * @name FileUtils.
 * @description File and directory utilities for node.js.
 *
 * @author Gabriel Llamas
 * @created 28/03/2012
 * @modified 16/08/2012
 * @version 0.2.4
 */
"use strict";

var FS = require ("fs");
var PATH = require ("path");
var UTIL = require ("util");
var CRYPTO = require ("crypto");

var Error = require ("errno-codes");

Error.create (Error.getNextAvailableErrno (), "NULL_PATH", 
		"Null path.");
Error.create (Error.getNextAvailableErrno (), "SECURITY_READ", 
		"Security error, cannot read \"{path}\".");
Error.create (Error.getNextAvailableErrno (), "SECURITY_WRITE", 
		"Security error, cannot write \"{path}\".");
Error.create (Error.getNextAvailableErrno (), "PATH_NO_DIR", 
		"The path \"{path}\" is not a directory.");
Error.create (Error.getNextAvailableErrno (), "PATH_NO_FILE", 
		"The path \"{path}\" is not a file.");
Error.create (Error.getNextAvailableErrno (), "DEEP", 
		"The deep must be greater than 0.");

var SLASH = PATH.normalize ("/");
var SM = null;

//Support to FS.exists and FS.existsSync
var EXISTS = FS.exists || PATH.exists;
var EXISTS_SYNC = FS.existsSync || PATH.existsSync;

var updateFileProperties = function (file, path){
	file._path = null;
	file._usablePath = null;
	file._isAbsolute = false;
	
	if (path.parent instanceof File){
		path.parent = path.parent._usablePath;
	}
	
	path.parent = PATH.normalize (path.parent);
	
	var index = path.parent.indexOf (":") + 1;
	var windowsRoot = path.parent.substring (0, index);
	path.parent = path.parent.substring (index);
	
	//UNC https://github.com/joyent/node/issues/3066
	if (path.parent[0] === "/" && path.parent[1] === "/"){
		path.parent = path.parent.replace (/[\/]/g, "\\");
		path.parent = path.parent.substring (0, path.parent.length - 1);
	}
	
	file._isAbsolute = path.parent[0] === SLASH;
	
	if (path.child !== undefined && path.child !== null){
		if (path.child instanceof File){
			path.child = path.child._path;
		}
		path.parent = PATH.join (path.parent, PATH.normalize (path.child));
	}
	
	file._path = windowsRoot + path.parent;
	file._usablePath = file._isAbsolute
		? file._path
		: (windowsRoot + PATH.join (file._relative, path.parent));
};

var File = function (parent, child){
	if (!parent) throw Error.get (Error.NULL_PATH);

	var main = process.mainModule.filename;
	var cwd = main.substring (0, main.lastIndexOf (SLASH));
	var relative = PATH.relative (process.cwd (), cwd);

	var me = this;
	this._relative = relative;
	this._removeOnExit = false;
	this._removeOnExitCallback = function (cb){
		if (!me._removeOnExit) return;
		var result = removeSynchronous (me);
		if (cb) cb (result.error, result.removed);
	};
	this._removeOnExitCallback.first = true;
	
	updateFileProperties (this, { parent: parent, child: child });
};

var canReadSM = function (path){
	if (!SM) return true;
	return !!(SM._getPermissions (path) & SecurityManager.READ);
};

var canWriteSM = function (path){
	if (!SM) return true;
	return !!(SM._getPermissions (path) & SecurityManager.WRITE);
};

var checkPermission = function (file, mask, cb){
	FS.stat (file, function (error, stats){
		if (error){
			cb (error, false);
		}else{
			cb (null, !!(mask & parseInt ((stats.mode & parseInt ("777", 8)).toString (8)[0])));
		}
	});
};

var setPermission = function (file, mask, action, cb){
	FS.stat (file, function (error, stats){
		if (error){
			if (cb) cb (error, false);
		}else{
			var permissions = (stats.mode & parseInt ("777", 8)).toString (8);
			var u = parseInt (permissions[0]);
			var can = !!(u & mask);
			if ((can && !action) || (!can && action)){
				var q = action ? mask : -mask;
				FS.chmod (file, (q + u) + permissions.substring (1), function (error){
					if (cb) cb (error, !error);
				});
			}else{
				if (cb) cb (null, false);
			}
		}
	});
};

File.prototype.canExecute = function (cb){
	if (!cb) return;
	cb = cb.bind (this);
	if (!canReadSM (this._usablePath)){
		return cb (Error.get (Error.SECURITY_READ, { path: this._usablePath }), false);
	}
	checkPermission (this._usablePath, 1, cb);
};

File.prototype.canRead = function (cb){
	if (!cb) return;
	cb = cb.bind (this);
	if (!canReadSM (this._usablePath)){
		return cb (Error.get (Error.SECURITY_READ, { path: this._usablePath }), false);
	}
	checkPermission (this._usablePath, 4, cb);
};

File.prototype.canWrite = function (cb){
	if (!cb) return;
	cb = cb.bind (this);
	if (!canReadSM (this._usablePath)){
		return cb (Error.get (Error.SECURITY_READ, { path: this._usablePath }), false);
	}
	checkPermission (this._usablePath, 2, cb);
};

File.prototype.checksum = function (algorithm, encoding, cb){
	if (arguments.length === 2 && typeof encoding === "function"){
		cb = encoding;
		encoding = "hex";
	}
	
	if (!cb) return;
	cb = cb.bind (this);
	if (!canReadSM (this._usablePath)){
		return cb (Error.get (Error.SECURITY_READ, { path: this._usablePath }), null);
	}
	
	var me = this;
	FS.stat (this._usablePath, function (error, stats){
		if (error){
			cb (error, null);
		}else if (stats.isDirectory ()){
			cb (Error.get (Error.PATH_NO_FILE, { path: me._usablePath }), null);
		}else if (stats.isFile ()){
			algorithm = CRYPTO.createHash (algorithm);
			var s = FS.ReadStream (me._usablePath);
			s.on ("error", function (error){
				cb (error, null);
			});
			s.on ("data", function (data){
				algorithm.update (data);
			});
			s.on ("end", function (){
				cb (null, algorithm.digest (encoding));
			});
		}
	});
};

File.prototype.contains = function (file, cb){
	if (!cb) return;
	if (!(file instanceof File)){
		file = new File (file);
	}
	file = file.getName ();
	
	list (null, cb, this, false, file, null);
};

File.prototype.copy = function (file, replace, cb){
	var argsLen = arguments.length;
	if (argsLen === 1){
		replace = false;
	}else if (argsLen === 2 && typeof replace === "function"){
		cb = replace;
		replace = false;
	}
	
	if (cb) cb = cb.bind (this);
	
	if (!canReadSM (this._usablePath)){
		if (cb) cb (Error.get (Error.SECURITY_READ, { path: this._usablePath }), false);
		return;
	}
	
	if (!(file instanceof File)){
		file = new File (file);
	}
	
	var path = file._path;
	file = file._usablePath;
	
	if (!canWriteSM (file)){
		if (cb) cb (Error.get (Error.SECURITY_WRITE, { path: file }), false);
		return;
	}
	
	var me = this;
	var copyFile = function (){
		var s = FS.createWriteStream (file);
		s.on ("error", function (error){
			if (cb) cb (error, false);
		});
		s.once ("open", function (fd){
			UTIL.pump (FS.createReadStream (me._usablePath), s, function (error){
				error = error === undefined ? null : error;
				if (cb) cb (error, !error);
			});
		});
	};
	var copyDirectory = function (){
		FS.mkdir (file, function (error){
			if (error){
				if (cb) cb (error, false);
			}else{
				FS.readdir (me._usablePath, function (error, files){
					if (error){
						if (cb) cb (error, false);
					}else{
						var filesLen = files.length;
						var done = 0;
						files.forEach (function (file){
							new File (PATH.join (me._path, file))
								.copy (PATH.join (path, file), function (error, copied){
									if (error){
										if (cb) cb (error, false);
									}else{
										done++;
										if (done === filesLen){
											if (cb) cb (null, true);
										}
									}
								});
						});
					}
				});
			}
		});
	};
	
	FS.stat (this._usablePath, function (error, stats){
		if (error){
			if (cb) cb (error, false);
		}else{
			EXISTS (file, function (exists){
				if (exists && !replace){
					if (cb) cb (null, false);
				}else{
					if (stats.isFile ()){
						copyFile ();
					}else if (stats.isDirectory ()){
						if (exists && replace){
							new File (path).remove (function (error, removed){
								if (error){
									if (cb) cb (error, false);
								}else{
									copyDirectory ();
								}
							});
						}else{
							copyDirectory ();
						}
					}
				}
			});
		}
	});
};

File.prototype.createDirectory = function (cb){
	if (cb) cb = cb.bind (this);
	
	if (!canWriteSM (this._usablePath)){
		if (cb) cb (Error.get (Error.SECURITY_WRITE, { path: this._usablePath }), false);
		return;
	}
	
	var mkdirDeep = function (path, cb){
		path.exists (function (exists){
			if (exists) return cb (null, false);
			
			FS.mkdir (path.getPath (), function (error){
				if (!error) return cb (null, true);
				
				var parent = path.getParentFile ();
				if (parent === null) return cb (null, false);
				
				mkdirDeep (parent, function (error, created){
					if (created){
						FS.mkdir (path.getPath (), function (error){
							cb (error, !error);
						});
					}else{
						parent.exists (function (exists){
							if (!exists) return cb (null, false);
							
							FS.mkdir (path.getPath (), function (error){
								cb (error, !error);
							});
						});
					}
				});
			});
		});
	};
	
	mkdirDeep (this.getAbsoluteFile (), function (error, created){
		if (cb) cb (error, created);
	});
};

File.prototype.createNewFile = function (cb){
	if (cb) cb = cb.bind (this);
	
	if (!canWriteSM (this._usablePath)){
		if (cb) cb (Error.get (Error.SECURITY_WRITE, { path: this._usablePath }), false);
		return;
	}
	
	var path = this._usablePath;
	EXISTS (path, function (exists){
		if (exists){
			if (cb) cb (null, false);
		}else{
			FS.createWriteStream (path)
				.on ("error", function (error){
					if (cb) cb (error, false);
				})
				.on ("close", function (){
					if (cb) cb (null, true);
				})
				.end ();
		}
	});
};

File.createTempFile = function (settings, cb){
	if (arguments.length === 1 && typeof settings === "function"){
		cb = settings;
		settings = null;
	}
	
	var pre = "";
	var suf = "";
	var dir = ".";
	
	if (settings){
		pre = settings.prefix ? settings.prefix : pre;
		suf = settings.suffix ? settings.suffix : suf;
		dir = settings.directory ? settings.directory.toString () : dir;
	}
	
	var random = Math.floor (Math.random ()*1000000000000);
	var file = new File (dir, pre + random + suf);
	
	if (!canWriteSM (file._usablePath)){
		if (cb) cb (Error.get (Error.SECURITY_WRITE, { path: file._usablePath }), false);
		return;
	}
	
	EXISTS (file._usablePath, function (exists){
		if (exists){
			File.createTempFile (settings, cb);
		}else{
			file.removeOnExit ();
			FS.createWriteStream (file._usablePath)
				.on ("error", function (error){
					if (cb) cb (error, null);
				})
				.on ("close", function (){
					if (cb) cb (null, file);
				})
				.end ();
		}
	});
};

File.createTempFolder = function (settings, cb){
	if (arguments.length === 1 && typeof settings === "function"){
		cb = settings;
		settings = null;
	}
	
	var pre = "";
	var suf = "";
	var dir = ".";
	
	if (settings){
		pre = settings.prefix ? settings.prefix : pre;
		suf = settings.suffix ? settings.suffix : suf;
		dir = settings.directory ? settings.directory.toString () : dir;
	}
	
	var random = Math.floor (Math.random ()*1000000000000);
	var folder = new File (dir, pre + random + suf);
	
	if (!canWriteSM (folder._usablePath)){
		if (cb) cb (Error.get (Error.SECURITY_WRITE, { path: folder._usablePath }), false);
		return;
	}
	
	EXISTS (folder._usablePath, function (exists){
		if (exists){
			File.createTempFolder (settings, cb);
		}else{
			folder.removeOnExit ();
			folder.createDirectory (function (error, created){
				if (error){
					if (cb) cb (error, null);
				}else{
					if (cb) cb (null, folder);
				}
			});
		}
	});
};

File.prototype.equals = function (file){
	var p = (file instanceof File) ?
		file.getAbsolutePath () :
		new File (file).getAbsolutePath ();
	return p === this.getAbsolutePath ();
};

File.prototype.exists = function (cb){
	if (!cb) return;
	cb = cb.bind (this);
	
	if (!canReadSM (this._usablePath)){
		return cb (Error.get (Error.SECURITY_READ, { path: this._usablePath }), false);
	}
	
	EXISTS (this._usablePath, function (exists){
		cb (exists);
	});
};

File.prototype.getAbsoluteFile = function (){
	return new File (this.getAbsolutePath ());
};

File.prototype.getAbsolutePath = function (){
	if (!this._path) return null;
	if (this._isAbsolute) return this._path;
	return PATH.join (PATH.dirname (process.mainModule.filename),
			this._path.substring (this._path.indexOf (":") + 1));
};

File.prototype.getBaseName = function (){
	if (!this._path) return null;
	var name = this.getName ();
	var ext = this.getExtension ();
	return ext ? name.substring (0, name.length - (ext.length + 1)) : name;
};

File.prototype.getExtension = function (){
	if (!this._path) return null;
	var ext = PATH.extname (this._path);
	return ext[0] === "." ? ext.substr (1) : ext;
};

File.prototype.getName = function (){
	if (!this._path) return null;
	var name = PATH.basename (this._path);
	return name === "." ? "" : name;
};

File.prototype.getOriginalPath = function (){
	return this._path;
};

File.prototype.getParent = function (){
	if (!this._path) return null;
	var index = this._path.lastIndexOf (SLASH);
	if (index === -1) return null;
	if (index === 0){
		if (this._path === SLASH) return null;
		else return "/";
	}
	return this._path.substring (0, index);
};

File.prototype.getParentFile = function (){
	var parent = this.getParent ();
	if (parent === null) return null;
	return new File (parent);
};

File.prototype.getPath = function (){
	return this._usablePath;
};

File.prototype.getPermissions = function (cb){
	if (!cb) return;
	cb = cb.bind (this);
	
	if (!canReadSM (this._usablePath)){
		return cb (Error.get (Error.SECURITY_READ, { path: this._usablePath }), null);
	}
	FS.stat (this._usablePath, function (error, stats){
		if (error){
			cb (error, null);
		}else{
			cb (null, (stats.mode & parseInt ("777", 8)).toString (8));
		}
	});
};

File.prototype.isAbsolute = function (){
	return this._isAbsolute;
}

File.prototype.isDirectory = function (cb){
	if (!cb) return;
	cb = cb.bind (this);
	
	if (!canReadSM (this._usablePath)){
		return cb (Error.get (Error.SECURITY_READ, { path: this._usablePath }), false);
	}
	FS.stat (this._usablePath, function (error, stats){
		if (error) cb (error, false);
		else cb (null, stats.isDirectory ());
	});
};

File.prototype.isEmpty = function (cb){
	if (!cb) return;
	cb = cb.bind (this);
	
	if (!canReadSM (this._usablePath)){
		return cb (Error.get (Error.SECURITY_READ, { path: this._usablePath }), false);
	}
	
	var me = this;
	
	FS.stat (this._usablePath, function (error, stats){
		if (error){
			if (cb) cb (error, false);
		}else if (stats.isFile ()){
			if (cb) cb (Error.get (Error.PATH_NO_DIR, { path: me._usablePath }), false);
		}else if (stats.isDirectory ()){
			FS.readdir (me._usablePath, function (error, files){
				if (error){
					if (cb) cb (error, false);
					return;
				}
				
				if (cb) cb (null, files.length === 0);
			});
		}
	});
};

File.prototype.isFile = function (cb){
	if (!cb) return;
	cb = cb.bind (this);
	
	if (!canReadSM (this._usablePath)){
		return cb (Error.get (Error.SECURITY_READ, { path: this._usablePath }), false);
	}
	FS.stat (this._usablePath, function (error, stats){
		if (error) cb (error, false);
		else cb (null, stats.isFile ());
	});
};

File.prototype.isHidden = function (){
	return this.getName ()[0] === ".";
};

File.prototype.isRoot = function (){
	var absolute = this.getAbsolutePath ();
	return absolute.substring (absolute.indexOf (":") + 1) === SLASH;
};

File.prototype.lastModified = function (cb){
	if (!cb) return;
	cb = cb.bind (this);
	
	if (!canReadSM (this._usablePath)){
		return cb (Error.get (Error.SECURITY_READ, { path: this._usablePath }), null);
	}
	FS.stat (this._usablePath, function (error, stats){
		if (error) cb (error, null);
		else cb (null, Date.parse (stats.mtime));
	});
};

var list = function (filter, cb, thisFile, withFiles, stopFile, deep){
	if (cb) cb = cb.bind (thisFile);
	
	if (!canReadSM (thisFile._usablePath)){
		return cb (Error.get (Error.SECURITY_READ, { path: thisFile._usablePath }),
				stopFile ? false : null);
	}
	
	var found = false;
	var exit = false;
	
	FS.stat (thisFile._usablePath, function (error, stats){
		if (error){
			if (cb) cb (error, stopFile ? false : null);
		}else if (stats.isFile ()){
			if (cb) cb (Error.get (Error.PATH_NO_DIR, { path: thisFile._usablePath }),
					stopFile ? false : null);
		}else if (stats.isDirectory ()){
			var applyFilter = function (filter, folder, files, result){
				if (!filter) return result (files);
				
				var f = [];
				var file;
				var wait = false;
				var len = files.length;
				
				files.forEach (function (file){
					var retFilter = null;
					var returnFilter = filter (file, PATH.join (folder, file),
							function (ret){
								if (ret) f.push (file);
								len--;
								if (len === 0){
									result (f);
								}
							});
							
					if (returnFilter){
						len--;
						f.push (file);
					}else if (returnFilter === undefined){
						wait = true;
					}
				});
				
				if (!wait) result (f);
			};
			
			var search = function (relativeFolder, folder, holder, filter, currentDeep, callback){
				currentDeep++;
				
				FS.readdir (relativeFolder, function (error, files){
					if (error){
						if (callback) callback (error, stopFile ? false : null);
						return;
					}

					applyFilter (filter, folder, files, function (files){
						var filesLen = files.length;
						var done = 0;
						var finish = function (){
							if (done === filesLen){
								if (callback){
									if (stopFile) callback (null, false);
									else callback (null, holder);
								}
								return true;
							}
							return false;
						};
						
						if (finish ()) return;
						var len = files.length;
						for (var i=0; i<len && !found; i++){
							(function (file){
								var filePath = PATH.join (folder, file);
								FS.stat (PATH.join (relativeFolder, file), function (error, stats){
									if (error){
										if (callback) callback (error, stopFile ? false : null);
										return;
									}
									if (stats.isFile ()){
										if (stopFile){
											if (file === stopFile && !exit){
												exit = true;
												found = true;
												return cb (null, true);
											}
										}
										
										holder[file] = withFiles ? new File (filePath) : filePath;
										done++;
										finish ();
									}else if (stats.isDirectory ()){
										holder[file] = {};
										
										if (currentDeep === deep){
											done++;
											finish ();
											return;
										}
										
										search (
											PATH.join (relativeFolder, file),
											filePath,
											holder[file],
											filter,
											currentDeep,
											function (error, files){
												if (error){
													if (callback) callback (error, stopFile
															? false
															: null);
													return;
												}
												done++;
												finish ();
											}
										);
									}
								});
							})(files[i]);
						};
					});
				});
			};
			
			search (thisFile._usablePath, thisFile._path, {}, filter, 0, cb);
		}
	});
};

File.prototype.list = function (filter, deep, cb){
	var argsLen = arguments.length;
	if (argsLen === 0) return;
	if (argsLen === 1){
		cb = filter;
		filter = null;
		deep = null;
	}else if (argsLen === 2){
		if (typeof filter === "number"){
			cb = deep;
			deep = filter;
			filter = null;
		}else{
			cb = deep;
			deep = null;
		}
	}
	
	if (deep !== null && deep < 1){
		return cb (Error.get (Error.DEEP), null);
	}
	
	list (filter, cb, this, false, null, deep);
};

File.prototype.listFiles = function (filter, deep, cb){
	var argsLen = arguments.length;
	if (argsLen === 0) return;
	if (argsLen === 1){
		cb = filter;
		filter = null;
		deep = null;
	}else if (argsLen === 2){
		if (typeof filter === "number"){
			cb = deep;
			deep = filter;
			filter = null;
		}else{
			cb = deep;
			deep = null;
		}
	}
	
	if (deep !== null && deep < 1){
		return cb (Error.get (Error.DEEP), null);
	}
	
	list (filter, cb, this, true, null, deep);
};

File.protect = function (sm){
	SM = sm;
};

File.prototype.remove = function (cb){
	if (cb) cb = cb.bind (this);
	
	if (!canWriteSM (this._usablePath)){
		if (cb) cb (Error.get (Error.SECURITY_WRITE, { path: this._usablePath }), false);
		return;
	}
	
	var me = this;
	FS.stat (this._usablePath, function (error, stats){
		if (error){
			if (cb) cb (error, false);
			return;
		}
		
		if (stats.isFile ()){
			FS.unlink (me._usablePath, function (error){
				if (cb){
					if (error) cb (error, false);
					else cb (null, true);
				}
			});
		}else if (stats.isDirectory ()){
			FS.readdir (me._usablePath, function (error, files){
				if (error){
					if (cb) cb (error, false);
					return;
				}
				
				var filesLen = files.length;
				var done = 0;
				var finish = function (){
					if (filesLen === done){
						FS.rmdir (me._usablePath, function (error){
							if (cb){
								if (error) cb (error, false);
								else cb (null, true);
							}
						});
						return true;
					}
					return false;
				};
				
				if (finish ()) return;
				for (var i in files){
					new File (PATH.join (me._path, files[i])).remove (function (error, removed){
						if (error){
							if (cb) cb (error, false);
						}else{
							done++;
							finish ();
						}
					});
				}
			});
		}
	});
};

var removeSynchronous = function (file){
	if (!canWriteSM (file._usablePath)){
		return { error: Error.get (Error.SECURITY_WRITE, { path: file._usablePath }),
				removed: false };
	}
	if (!EXISTS_SYNC (file._usablePath)) return { error: null, removed: false };
	
	var stats = FS.statSync (file._usablePath);
	var result;
	
	if (stats.isFile ()){
		FS.unlinkSync (file._usablePath);
	}else if (stats.isDirectory ()){
		var files = FS.readdirSync (file._usablePath);
		for (var i in files){
			result = removeSynchronous (new File (PATH.join (file._path, files[i])));
			if (result.error) return { error: result.error, removed: result.removed };
		}
		FS.rmdirSync (file._usablePath);
	}
	
	return { error: null, removed: true };
};

File.prototype.removeOnExit = function (remove, cb){
	var argsLen = arguments.length;
	if (argsLen === 0){
		remove = true;
	}else if (argsLen === 1 && typeof remove === "function"){
		cb = remove;
		remove = true;
	}
	
	if (cb) cb = cb.bind (this);
	
	this._removeOnExit = remove;
	
	if (remove && this._removeOnExitCallback.first){
		this._removeOnExitCallback.first = false;
		var me = this;
		process.on ("exit", function (){
			me._removeOnExitCallback (cb);
		});
	}
};

File.prototype.rename = function (file, replace, cb){
	var argsLen = arguments.length;
	if (argsLen === 1){
		replace = false;
	}else if (argsLen === 2 && typeof replace === "function"){
		cb = replace;
		replace = false;
	}
	
	if (cb) cb = cb.bind (this);
	
	if (!(file instanceof File)){
		file = new File (file);
	}
	
	if (!canWriteSM (this._usablePath)){
		if (cb) cb (Error.get (Error.SECURITY_WRITE, { path: this._usablePath }), false);
		return;
	}
	
	if (!canWriteSM (file._usablePath)){
		if (cb) cb (Error.get (Error.SECURITY_WRITE, { path: file._usablePath }), false);
		return;
	}
	
	var path = file._path;
	file = file._usablePath;
	
	var me = this;
	
	var rename = function (){
		FS.rename (me._usablePath, file, function (error){
			if (error){
				if (cb) cb (error, false);
			}else{
				updateFileProperties (me, { parent: path });
				if (cb) cb (null, true);
			}
		});
	};
	
	if (replace){
		rename ();
	}else{
		EXISTS (file, function (exists){
			if (exists){
				if (cb) cb (null, false);
			}else{
				rename ();
			}
		});
	}
};

var search = function (file, cb, thisfile, withFiles){
	if (!cb) return;
	cb = cb.bind (thisfile);
	
	if (!canReadSM (thisfile._usablePath)){
		return cb (Error.get (Error.SECURITY_READ, { path: thisFile._usablePath }), null);
	}
	
	if (file instanceof File) file = file.getName ();
	var files = [];
	
	thisfile.list (function (name, path){
		if (name === file){
			files.push (withFiles ? new File (path) : path);
		}
		return true;
	}, function (error){
		if (error) cb (error, null);
		else cb (null, files);
	});
};

File.prototype.search = function (file, cb){
	search (file, function (error, files){
		if (cb) cb (error, files);
	}, this, false);
};

File.prototype.searchFiles = function (file, cb){
	search (file, function (error, files){
		if (cb) cb (error, files);
	}, this, true);
};

File.prototype.setExecutable = function (executable, cb){
	var argsLen = arguments.length;
	if (argsLen === 0){
		executable = true;
	}else if (argsLen === 1 && typeof executable === "function"){
		cb = executable;
		executable = true;
	}
	
	if (cb) cb = cb.bind (this);
	
	if (process.platform === "win32"){
		if (cb) cb (null, false);
	}
	if (!canWriteSM (this._usablePath)){
		if (cb) cb (Error.get (Error.SECURITY_WRITE, { path: this._usablePath }), false);
		return;
	}
	
	setPermission (this._usablePath, 1, executable, cb);
};

File.prototype.setPermissions = function (permissions, cb){
	if (cb) cb = cb.bind (this);
	
	if (!canWriteSM (this._usablePath)){
		if (cb) cb (Error.get (Error.SECURITY_WRITE, { path: this._usablePath }), false);
		return;
	}
	
	FS.chmod (this._usablePath, permissions, function (error){
		if (cb) cb (error, !error);
	});
};

File.prototype.setReadable = function (readable, cb){
	var argsLen = arguments.length;
	if (argsLen === 0){
		readable = true;
	}else if (argsLen === 1 && typeof readable === "function"){
		cb = readable;
		readable = true;
	}
	
	if (cb) cb = cb.bind (this);
	
	if (process.platform === "win32"){
		if (cb) cb (null, false);
	}
	if (!canWriteSM (this._usablePath)){
		if (cb) cb (Error.get (Error.SECURITY_WRITE, { path: this._usablePath }), false);
		return;
	}
	
	setPermission (this._usablePath, 4, readable, cb);
};

File.prototype.setReadOnly = function (cb){
	if (cb) cb = cb.bind (this);
	
	if (!canWriteSM (this._usablePath)){
		if (cb) cb (Error.get (Error.SECURITY_WRITE, { path: this._usablePath }), false);
		return;
	}
	
	FS.chmod (this._usablePath, "444", function (error){
		cb (error, !error);
	});
};

File.prototype.setWritable = function (writable, cb){
	var argsLen = arguments.length;
	if (argsLen === 0){
		writable = true;
	}else if (argsLen === 1 && typeof writable === "function"){
		cb = writable;
		writable = true;
	}
	
	if (cb) cb = cb.bind (this);
	
	if (!canWriteSM (this._usablePath)){
		if (cb) cb (Error.get (Error.SECURITY_WRITE, { path: this._usablePath }), false);
		return;
	}
	
	setPermission (this._usablePath, 2, writable, cb);
};

File.prototype.size = function (cb){
	if (!cb) return;
	cb = cb.bind (this);
	
	if (!canReadSM (this._usablePath)){
		return cb (Error.get (Error.SECURITY_READ, { path: this._usablePath }), 0);
	}
	
	var total = 0;
	var me = this;
	
	var calculateSize = function (cb){
		FS.stat (me._usablePath, function (error, stats){
			if (error){
				cb (error, null);
			}else if (stats.isFile ()){
				cb (null, stats.size);
			}else if (stats.isDirectory ()){
				FS.readdir (me._usablePath, function (error, files){
					var filesLen = files.length;
					var done = 0;
					
					var finish = function (){
						if (done === filesLen){
							cb (null, total);
							return true;
						}
						return false;
					};
					
					if (finish ()) return;
					files.forEach (function (file){
						new File (PATH.join (me._path, file)).size (function (error, size){
							if (error){
								cb (error, 0);
							}else{
								total += size;
								done++;
								finish ();
							}
						});
					});
				});
			}
		});
	};
	
	calculateSize (cb);
};

File.prototype.toString = function (){
	return this._path;
};

var SecurityManager = function (){
	this._permissions = {};
	
	var cwd = new File (".").getAbsolutePath ().replace (/\\/g, "/");
	this._permissions[cwd] = SecurityManager.READ_WRITE;
};

SecurityManager.NONE = 0;
SecurityManager.READ = 1;
SecurityManager.WRITE = 2;
SecurityManager.READ_WRITE = 3;

var getAbsolutePath = function (path){
	return (path instanceof File) ? path.getAbsolutePath () : new File (path).getAbsolutePath ();
};

SecurityManager.prototype._getPermissions = function (path){
	path = getAbsolutePath (path).replace (/\\/g, "/");
	
	var lastValid = {
		path: null,
		perm: null
	};
	
	for (var p in this._permissions){
		var re = new RegExp ("^" + p);
		
		if (path.match (re)){
			if (!lastValid.path || !lastValid.path.match (re)){
				lastValid.path = p;
				lastValid.perm = this._permissions[p];
			}
		}
	}
	
	return lastValid.path ? lastValid.perm : SecurityManager.READ;
};

SecurityManager.prototype.allow = function (path, permissions){
	this._permissions[getAbsolutePath (path).replace (/\\/g, "/")] = permissions;
};

SecurityManager.prototype.deny = function (path, permissions){
	this._permissions[getAbsolutePath (path).replace (/\\/g, "/")] = ~permissions;
};

module.exports = {
	File: File,
	SecurityManager: SecurityManager
};