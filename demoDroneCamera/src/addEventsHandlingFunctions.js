
	/*  Agregar 3 funciones al prototype para manejar eventos   addEventListener, removeEventListener y dispatchEvent  */
    
	function addEventsHandlingFunctions(obj) {
	
		obj._listerners=Object.create(null);
		/**
		 * Adds an event listener to this Acceleration Module.
		 * @param {string} type The name of the command.
		 * @param handler The handler for the cmomand. This is called whenever the command is received.
		 */
		var addEventListener = function (type, handler) {
			if (!this._listerners) {
				this._listerners = Object.create(null);
			}
			if (!(type in this._listerners)) {
				this._listerners[type] = [handler];
			} else {
				var handlers = this._listerners[type];
				if (handlers.indexOf(handler) < 0) {
					handlers.push(handler);
				}
			}
		}
	
		/**
		 * Removes an event listener from this Acceleration Module.
		 * @param {string} type The name of the command.
		 * @param handler The handler for the cmomand. This is called whenever the command is received.
		 */
		var removeEventListener = function (type, handler) {
			if (!this._listerners) {
				// No listeners
				return;
			}
			if (type in this._listerners) {
				var handlers = this._listerners[type];
				var index = handlers.indexOf(handler);
				if (index >= 0) {
					if (handlers.length == 1) {
						// Listeners list would be empty, delete it
						delete this._listerners[type];
					} else {
						// Remove the handler
						handlers.splice(index, 1);
					}
				}
			}
		}
		var dispatchEvent = function (event) {
			if (!this._listerners) {
				return true;
			}
			var type = event.type;
			if (type in this._listerners) {
				// Make a copy to walk over
				var handlers = this._listerners[type].concat();
				for (var i = 0, handler; handler = handlers[i]; i++) {
					handler.call(this, event);
				}
			}
		}
		
		if(obj.prototype){
			obj.prototype.addEventListener=addEventListener;
			obj.prototype.removeEventListener=removeEventListener;
			obj.prototype.dispatchEvent=dispatchEvent;
		}else{
			obj.addEventListener=addEventListener;
			obj.removeEventListener=removeEventListener;
			obj.dispatchEvent=dispatchEvent;
		}
	
	}	


    export {addEventsHandlingFunctions}