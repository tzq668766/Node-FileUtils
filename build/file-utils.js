"use strict";var FS=require("fs"),PATH=require("path"),UTIL=require("util"),CRYPTO=require("crypto"),SLASH=PATH.normalize("/"),NULL_PATH_ERROR=new Error("Null path."),SECURITY_READ_ERROR=new Error("Security error, cannot read."),SECURITY_WRITE_ERROR=new Error("Security error, cannot write."),SECURITY_READ_WRITE_ERROR=new Error("Security error, cannot read nor write."),SM=null,EXISTS=FS.exists||PATH.exists,EXISTS_SYNC=FS.existsSync||PATH.existsSync,updateFileProperties=function(e,t){e._path=null,e._usablePath=null,e._isAbsolute=!1;if(t.parent===undefined||t.parent===null)return;t.parent instanceof File&&(t.parent=t.parent._usablePath),t.parent=PATH.normalize(t.parent);var n=t.parent.indexOf(":")+1,r=t.parent.substring(0,n);t.parent=t.parent.substring(n),t.parent[0]==="/"&&t.parent[1]==="/"&&(t.parent=t.parent.replace(/[\/]/g,"\\"),t.parent=t.parent.substring(0,t.parent.length-1)),e._isAbsolute=t.parent[0]===SLASH,t.child!==undefined&&t.child!==null&&(t.child instanceof File&&(t.child=t.child._path),t.parent=PATH.join(t.parent,PATH.normalize(t.child))),e._path=r+t.parent,e._usablePath=e._isAbsolute?e._path:r+PATH.join(e._relative,t.parent)},File=function(e,t){var n=process.mainModule.filename,r=n.substring(0,n.lastIndexOf(SLASH)),i=PATH.relative(process.cwd(),r),s=this;this._relative=i,this._removeOnExit=!1,this._removeOnExitCallback=function(e){if(!s._removeOnExit)return;try{var t=removeSynchronous(s);t instanceof Error?e&&e(t,!1):e&&e(null,t)}catch(n){e&&e(n)}},this._removeOnExitCallback.first=!0,updateFileProperties(this,{parent:e,child:t})},canReadSM=function(e){return SM?SecurityManager._checkSecurity(e)&SecurityManager.READ.id:!0},canWriteSM=function(e){return SM?SecurityManager._checkSecurity(e)&SecurityManager.WRITE.id:!0},canReadWriteSM=function(e){return SM?SecurityManager._checkSecurity(e)&SecurityManager.READ_WRITE.id:!0},checkPermission=function(e,t,n){FS.stat(e,function(e,r){e?n(e,!1):n(null,!!(t&parseInt((r.mode&parseInt("777",8)).toString(8)[0])))})},setPermission=function(e,t,n,r){FS.stat(e,function(i,s){if(i)r&&r(i,!1);else{var o=(s.mode&parseInt("777",8)).toString(8),u=parseInt(o[0]),a=!!(u&t);if(a&&!n||!a&&n){var f=n?t:-t;FS.chmod(e,f+u+o.substring(1),function(e){r&&r(e,!e)})}else r&&r(null,!1)}})};File.prototype.canExecute=function(e){if(!e)return;e=e.bind(this);if(!this._path)return e(NULL_PATH_ERROR,!1);if(!canReadSM(this._usablePath))return e(SECURITY_READ_ERROR,!1);checkPermission(this._usablePath,1,e)},File.prototype.canRead=function(e){if(!e)return;e=e.bind(this);if(!this._path)return e(NULL_PATH_ERROR,!1);if(!canReadSM(this._usablePath))return e(SECURITY_READ_ERROR,!1);checkPermission(this._usablePath,4,e)},File.prototype.canWrite=function(e){if(!e)return;e=e.bind(this);if(!this._path)return e(NULL_PATH_ERROR,!1);if(!canReadSM(this._usablePath))return e(SECURITY_READ_ERROR,!1);checkPermission(this._usablePath,2,e)},File.prototype.checksum=function(e,t,n){arguments.length===2&&typeof t=="function"&&(n=t,t="hex");if(!n)return;n=n.bind(this);if(!this._path)return n(NULL_PATH_ERROR,null);if(!canReadSM(this._usablePath))return n(SECURITY_READ_ERROR,null);var r=this;FS.stat(this._usablePath,function(i,s){if(i)n(i,null);else if(s.isDirectory())n("The abstract path is a directory.",null);else if(s.isFile()){e=CRYPTO.createHash(e);var o=FS.ReadStream(r._usablePath);o.on("error",function(e){n(e,null)}),o.on("data",function(t){e.update(t)}),o.on("end",function(){n(null,e.digest(t))})}})},File.prototype.contains=function(e,t){if(!t)return;e instanceof File&&(e=e.getName()),list(null,t,this,!1,e)},File.prototype.copy=function(e,t,n){var r=arguments.length;r===1?t=!1:r===2&&typeof t=="function"&&(n=t,t=!1),n&&(n=n.bind(this));if(!this._path){n&&n(NULL_PATH_ERROR,!1);return}if(!canReadWriteSM(this._usablePath)){n&&n(SECURITY_READ_WRITE_ERROR,!1);return}e instanceof File||(e=new File(e));var i=e._path;e=e._usablePath;var s=this,o=function(){var t=FS.createWriteStream(e);t.on("error",function(e){n&&n(e,!1)}),t.once("open",function(e){UTIL.pump(FS.createReadStream(s._usablePath),t,function(e){e=e===undefined?null:e,n&&n(e,!e)})})},u=function(){FS.mkdir(e,function(e){e?n&&n(e,!1):FS.readdir(s._usablePath,function(e,t){if(e)n&&n(e,!1);else{var r=t.length,o=0;t.forEach(function(e){(new File(PATH.join(s._path,e))).copy(PATH.join(i,e),function(e,t){e?n&&n(e,!1):(o++,o===r&&n&&n(null,!0))})})}})})};FS.stat(this._usablePath,function(r,s){r?n&&n(r,!1):EXISTS(e,function(e){e&&!t?n&&n(null,!1):s.isFile()?o():s.isDirectory()&&(e&&t?(new File(i)).remove(function(e,t){e?n&&n(e,!1):u()}):u())})})},File.prototype.createDirectory=function(e){e&&(e=e.bind(this));if(!this._path){e&&e(NULL_PATH_ERROR,!1);return}if(!canWriteSM(this._usablePath)){e&&e(SECURITY_WRITE_ERROR,!1);return}var t=function(e,n){e.exists(function(r){if(r)return n(null,!1);FS.mkdir(e.getPath(),function(r){if(!r)return n(null,!0);var i=e.getParentFile();if(i===null)return n(null,!1);t(i,function(t,r){r?FS.mkdir(e.getPath(),function(e){n(e,!e)}):i.exists(function(t){if(!t)return n(null,!1);FS.mkdir(e.getPath(),function(e){n(e,!e)})})})})})};t(this.getAbsoluteFile(),function(t,n){e&&e(t,n)})},File.prototype.createNewFile=function(e){e&&(e=e.bind(this));if(!this._path){e&&e(NULL_PATH_ERROR,!1);return}if(!canWriteSM(this._usablePath)){e&&e(SECURITY_WRITE_ERROR,!1);return}var t=this._usablePath;EXISTS(t,function(n){n?e&&e(null,!1):FS.createWriteStream(t).on("error",function(t){e&&e(t,!1)}).on("close",function(){e&&e(null,!0)}).end()})},File.createTempFile=function(e,t){arguments.length===1&&typeof e=="function"&&(t=e,e=null);var n="",r="",i=".";e&&(n=e.prefix?e.prefix:n,r=e.suffix?e.suffix:r,i=e.directory?e.directory.toString():i);var s=Math.floor(Math.random()*1e12),o=new File(i,n+s+r);if(!canWriteSM(o._usablePath)){t&&t(SECURITY_WRITE_ERROR,!1);return}EXISTS(o._usablePath,function(n){n?File.createTempFile(e,t):(o.removeOnExit(),FS.createWriteStream(o._usablePath).on("error",function(e){t&&t(e,null)}).on("close",function(){t&&t(null,o)}).end())})},File.createTempFolder=function(e,t){arguments.length===1&&typeof e=="function"&&(t=e,e=null);var n="",r="",i=".";e&&(n=e.prefix?e.prefix:n,r=e.suffix?e.suffix:r,i=e.directory?e.directory.toString():i);var s=Math.floor(Math.random()*1e12),o=new File(i,n+s+r);if(!canWriteSM(o._usablePath)){t&&t(SECURITY_WRITE_ERROR,!1);return}EXISTS(o._usablePath,function(n){n?File.createTempFolder(e,t):(o.removeOnExit(),o.createDirectory(function(e,n){e?t&&t(e,null):t&&t(null,o)}))})},File.prototype.equals=function(e){var t=e instanceof File?e.getAbsolutePath():(new File(e)).getAbsolutePath();return t===this.getAbsolutePath()},File.prototype.exists=function(e){if(!e)return;e=e.bind(this);if(!this._path)return e(NULL_PATH_ERROR,!1);if(!canReadSM(this._usablePath))return e(SECURITY_READ_ERROR,!1);EXISTS(this._usablePath,function(t){e(t)})},File.prototype.getAbsoluteFile=function(){return new File(this.getAbsolutePath())},File.prototype.getAbsolutePath=function(){return this._path?this._isAbsolute?this._path:PATH.join(PATH.dirname(process.mainModule.filename),this._path):null},File.prototype.getName=function(){return this._path?PATH.basename(this._path):null},File.prototype.getOriginalPath=function(){return this._path},File.prototype.getParent=function(){if(!this._path)return null;var e=this._path.lastIndexOf(SLASH);return e===-1?null:e===0?this._path===SLASH?null:"/":this._path.substring(0,e)},File.prototype.getParentFile=function(){var e=this.getParent();return e===null?null:new File(e)},File.prototype.getPath=function(){return this._usablePath},File.prototype.getPermissions=function(e){if(!e)return;e=e.bind(this);if(!this._path)return e(NULL_PATH_ERROR,null);if(!canReadSM(this._usablePath))return e(SECURITY_READ_ERROR,null);FS.stat(this._usablePath,function(t,n){t?e(t,null):e(null,(n.mode&parseInt("777",8)).toString(8))})},File.prototype.isAbsolute=function(){return this._isAbsolute},File.prototype.isDirectory=function(e){if(!e)return;e=e.bind(this);if(!this._path)return e(NULL_PATH_ERROR,!1);if(!canReadSM(this._usablePath))return e(SECURITY_READ_ERROR,!1);FS.stat(this._usablePath,function(t,n){t?e(t,!1):e(null,n.isDirectory())})},File.prototype.isFile=function(e){if(!e)return;e=e.bind(this);if(!this._path)return e(NULL_PATH_ERROR,!1);if(!canReadSM(this._usablePath))return e(SECURITY_READ_ERROR,!1);FS.stat(this._usablePath,function(t,n){t?e(t,!1):e(null,n.isFile())})},File.prototype.isHidden=function(){return this.getName()[0]==="."},File.prototype.lastModified=function(e){if(!e)return;e=e.bind(this);if(!this._path)return e(NULL_PATH_ERROR,null);if(!canReadSM(this._usablePath))return e(SECURITY_READ_ERROR,null);FS.stat(this._usablePath,function(t,n){t?e(t,null):e(null,n.mtime)})};var list=function(e,t,n,r,i){t&&(t=t.bind(n));if(!n._path)return t(NULL_PATH_ERROR,i?!1:null);if(!canReadSM(n._usablePath))return t(SECURITY_READ_ERROR,i?!1:null);var s=!1,o=!1;FS.stat(n._usablePath,function(u,a){if(u)t&&t(u,i?!1:null);else if(a.isFile())t&&t("The path is not a directory.",i?!1:null);else if(a.isDirectory()){var f=function(t,n){var r=[],i;return n.forEach(function(n){e(n,PATH.join(t,n))&&r.push(n)}),r},l=function(e,n,u,a,c){FS.readdir(e,function(h,p){if(h){c&&c(h,i?!1:null);return}a&&(p=f(n,p));var d=p.length,v=0,m=function(){return v===d?(c&&(i?c(null,!1):c(null,u)),!0):!1};if(m())return;var g=p.length;for(var y=0;y<g&&!s;y++)(function(f){var h=PATH.join(n,f);FS.stat(PATH.join(e,f),function(n,p){if(n)return c(n,i?!1:null);if(p.isFile()){if(i&&f===i&&!o)return o=!0,s=!0,t(null,!0);u[f]=r?new File(h):h,v++,m()}else p.isDirectory()&&(u[f]={},l(PATH.join(e,f),h,u[f],a,function(e,t){if(e){c&&c(e,i?!1:null);return}v++,m()}))})})(p[y])})};l(n._usablePath,n._path,{},e,t)}})};File.prototype.list=function(e,t){var n=arguments.length;if(n===0)return;n===1&&(t=e,e=null),list(e,t,this,!1,null)},File.prototype.listFiles=function(e,t){var n=arguments.length;if(n===0)return;n===1&&(t=e,e=null),list(e,t,this,!0,null)},File.protect=function(e){SM=e},File.prototype.remove=function(e){e&&(e=e.bind(this));if(!this._path){e&&e(NULL_PATH_ERROR,!1);return}if(!canWriteSM(this._usablePath)){e&&e(SECURITY_WRITE_ERROR,!1);return}var t=this;FS.stat(this._usablePath,function(n,r){if(n){e&&e(n,!1);return}r.isFile()?FS.unlink(t._usablePath,function(t){e&&(t?e(t,!1):e(null,!0))}):r.isDirectory()&&FS.readdir(t._usablePath,function(n,r){if(n){e&&e(n,!1);return}var i=r.length,s=0,o=function(){return i===s?(FS.rmdir(t._usablePath,function(t){e&&(t?e(t,!1):e(null,!0))}),!0):!1};if(o())return;for(var u in r)(new File(PATH.join(t._path,r[u]))).remove(function(t,n){t?e&&e(t,!1):(s++,o())})})})};var removeSynchronous=function(e){if(!e._path)return!1;if(!canWriteSM(e._usablePath))return SECURITY_WRITE_ERROR;if(!EXISTS_SYNC(e._usablePath))return!1;var t=FS.statSync(e._usablePath);if(t.isFile())FS.unlinkSync(e._usablePath);else if(t.isDirectory()){var n=FS.readdirSync(e._usablePath);for(var r in n)removeSynchronous(new File(PATH.join(e._path,n[r])));FS.rmdirSync(e._usablePath)}return!0};File.prototype.removeOnExit=function(e,t){var n=arguments.length;n===0?e=!0:n===1&&typeof e=="function"&&(t=e,e=!0),t&&(t=t.bind(this)),this._removeOnExit=e;if(e&&this._removeOnExitCallback.first){this._removeOnExitCallback.first=!1;var r=this;process.on("exit",function(){r._removeOnExitCallback(t)})}},File.prototype.rename=function(e,t,n){var r=arguments.length;r===1?t=!1:r===2&&typeof t=="function"&&(n=t,t=!1),n&&(n=n.bind(this));if(!this._path){n&&n(NULL_PATH_ERROR,!1);return}if(!canWriteSM(this._usablePath)){n&&n(SECURITY_WRITE_ERROR,!1);return}e instanceof File||(e=new File(e));var i=e._path;e=e._usablePath;var s=this,o=function(){FS.rename(s._usablePath,e,function(e){e?n&&n(e,!1):(updateFileProperties(s,{parent:i}),n&&n(null,!0))})};t?o():EXISTS(e,function(e){e?n&&n(null,!1):o()})};var search=function(e,t,n,r){if(!t)return;t=t.bind(n);if(!n._path)return t(NULL_PATH_ERROR,!1);if(!canReadSM(n._usablePath))return t(SECURITY_READ_ERROR,null);e instanceof File&&(e=e.getName());var i=[];n.list(function(t,n){return t===e&&i.push(r?new File(n):n),!0},function(e){e?t(e,null):t(null,i)})};File.prototype.search=function(e,t){search(e,function(e,n){t&&t(e,n)},this,!1)},File.prototype.searchFiles=function(e,t){search(e,function(e,n){t&&t(e,n)},this,!0)},File.prototype.setExecutable=function(e,t){var n=arguments.length;n===0?e=!0:n===1&&typeof e=="function"&&(t=e,e=!0),t&&(t=t.bind(this));if(!this._path){t&&t(NULL_PATH_ERROR,!1);return}process.platform==="win32"&&t&&t(null,!1);if(!canWriteSM(this._usablePath)){t&&t(SECURITY_WRITE_ERROR,!1);return}setPermission(this._usablePath,1,e,t)},File.prototype.setPermissions=function(e,t){t&&(t=t.bind(this));if(!this._path){t&&t(NULL_PATH_ERROR,!1);return}if(!canWriteSM(this._usablePath)){t&&t(SECURITY_WRITE_ERROR,!1);return}FS.chmod(this._usablePath,e,function(e){t&&t(e,!e)})},File.prototype.setReadable=function(e,t){var n=arguments.length;n===0?e=!0:n===1&&typeof e=="function"&&(t=e,e=!0),t&&(t=t.bind(this));if(!this._path){t&&t(NULL_PATH_ERROR,!1);return}process.platform==="win32"&&t&&t(null,!1);if(!canWriteSM(this._usablePath)){t&&t(SECURITY_WRITE_ERROR,!1);return}setPermission(this._usablePath,4,e,t)},File.prototype.setReadOnly=function(e){e&&(e=e.bind(this));if(!this._path){e&&e(NULL_PATH_ERROR,!1);return}if(!canWriteSM(this._usablePath)){e&&e(SECURITY_WRITE_ERROR,!1);return}FS.chmod(this._usablePath,"444",function(t){e(t,!t)})},File.prototype.setWritable=function(e,t){var n=arguments.length;n===0?e=!0:n===1&&typeof e=="function"&&(t=e,e=!0),t&&(t=t.bind(this));if(!this._path){t&&t(NULL_PATH_ERROR,!1);return}if(!canWriteSM(this._usablePath)){t&&t(SECURITY_WRITE_ERROR,!1);return}setPermission(this._usablePath,2,e,t)},File.prototype.size=function(e){if(!e)return;e=e.bind(this);if(!this._path)return e(NULL_PATH_ERROR,0);if(!canReadSM(this._usablePath))return e(SECURITY_READ_ERROR,0);var t=0,n=this,r=function(e){FS.stat(n._usablePath,function(r,i){r?e(r,null):i.isFile()?e(null,i.size):i.isDirectory()&&FS.readdir(n._usablePath,function(r,i){var s=i.length,o=0,u=function(){return o===s?(e(null,t),!0):!1};if(u())return;i.forEach(function(r){(new File(PATH.join(n._path,r))).size(function(n,r){n?e(n,0):(t+=r,o++,u())})})})})};r(e)},File.prototype.toString=function(){return this._path};var SecurityManager=function(){this._allow=[{directory:(new File(".")).getAbsolutePath(),permissions:SecurityManager.READ_WRITE}],this._deny=[]};SecurityManager.NONE=Object.freeze({id:0}),SecurityManager.READ=Object.freeze({id:1}),SecurityManager.WRITE=Object.freeze({id:2}),SecurityManager.READ_WRITE=Object.freeze({id:3});var getAbsolutePath=function(e){return e instanceof File?e.getAbsolutePath():(new File(e)).getAbsolutePath()};SecurityManager._checkSecurity=function(e){e=getAbsolutePath(e).replace(/\\/g,"/");var t=function(e){var t=e^SecurityManager.READ_WRITE.id;for(var n in SecurityManager){n=SecurityManager[n];if(n.id===t)return n.id}},n=function(n,r){var i={dir:null,perm:null};for(var s in n){var o=n[s],u=o.directory.replace(/\\/g,"/"),a=new RegExp("^"+u);e.match(a)&&(!i.dir||!i.dir.match(a))&&(i.dir=u,i.perm=r?t(o.permissions.id):o.permissions.id)}return i.perm},r=n(SM._deny,!0);return r!==null?r:(r=n(SM._allow,!1),r!==null?r:SecurityManager.READ.id)},SecurityManager.prototype.allow=function(e,t){this._allow.push({directory:getAbsolutePath(e),permissions:t?t:SecurityManager.READ_WRITE})},SecurityManager.prototype.deny=function(e,t){this._deny.push({directory:getAbsolutePath(e),permissions:t?t:SecurityManager.READ_WRITE})},module.exports={File:File,SecurityManager:SecurityManager};