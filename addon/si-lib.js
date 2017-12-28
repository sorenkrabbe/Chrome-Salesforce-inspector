/**
 * Collection generally reusable components and methods for the Salesforce Inspector
 */
/* exported SILib */
"use strict";


let SILib = {
  /**
   * Base class model for controlling state and data of SI pages.
   */
  SIPageModel: class SIPageModel {
    constructor(sfHost) {
      this.reactCallback = null;

      // Processed data and UI state
      this.sfHost = sfHost;
      this.sfLink = "https://" + this.sfHost;
      this.spinnerCount = 0;
      this.errorMessages = [];
    }

    /**
    * Selects and copies elementToCopy to client's clipboard.
    * Will show confirmationMessage" on success and a standard error message on error. Both presented as native JS alerts
    */
    copyElementToClipboard(elementToCopy, confirmationMessage) {
      //Select element to copy (based off https://stackoverflow.com/questions/2044616/select-a-complete-table-with-javascript-to-be-copied-to-clipboard)
      let body = document.body;
      let range, sel;

      if (document.createRange && window.getSelection) {
        range = document.createRange();
        sel = window.getSelection();
        sel.removeAllRanges();
        try {
          range.selectNodeContents(elementToCopy);
          sel.addRange(range);
        } catch (e) {
          range.selectNode(elementToCopy);
          sel.addRange(range);
        }
      } else if (body.createTextRange) {
        range = body.createTextRange();
        range.moveToElementText(elementToCopy);
        range.select();
      }

      //Attempt to run "copy" command and report result to user
      try {
        let successful = document.execCommand("copy");

        if (successful) {
          alert(confirmationMessage);
        } else {
          alert("Copy to clipboard failed");
        }
      } catch (err) {
        alert("Copy to clipboard failed. See browser console for details");
        console.log(err);
      }

      window.getSelection().removeAllRanges();
    }

    /**
     * Notify React that we changed something, so it will rerender the view.
     * Should only be called once at the end of an event or asynchronous operation, since each call can take some time.
     * All event listeners (functions starting with "on") should call this function if they update the model.
     * Asynchronous operations should use the spinFor function, which will call this function after the asynchronous operation completes.
     * Other functions should not call this function, since they are called by a function that does.
     * @param cb A function to be called once React has processed the update.
     */
    didUpdate(cb) {
      if (this.reactCallback) {
        this.reactCallback(cb);
      }
    }

    /**
     * Show the spinner while waiting for a promise, and show an error if it fails.
     * didUpdate() must be called after calling spinFor.
     * didUpdate() is called when the promise is resolved or rejected, so the caller doesn't have to call it, when it updates the model just before resolving the promise, for better performance.
     * @param actionName Name to show in the errors list if the operation fails.
     * @param promise The promise to wait for.
     */
    spinFor(actionName, promise, cb) {
      this.spinnerCount++;
      promise
        .then(res => {
          this.spinnerCount--;
          cb(res);
          this.didUpdate();
        })
        .catch(err => {
          console.error(err);
          this.errorMessages.push("Error " + actionName + ": " + err.message);
          this.spinnerCount--;
          this.didUpdate();
        })
        .catch(err => console.log("error handling failed", err));
    }
  },

  /**
   * Setup SI page by establishing API connection, initializing the model of the page and render React components.
   * TODO: Parameters and logic to be generalized
   */
  startPage(sfConn, initButton, ReactDOM, Model, App, h) {
    let args = new URLSearchParams(location.search.slice(1));
    let sfHost = args.get("host");
    initButton(sfHost, true);
    sfConn.getSession(sfHost).then(() => {
      let root = document.getElementById("root");
      let model = new Model(sfHost);
      model.startLoading(args);
      model.reactCallback = cb => {
        ReactDOM.render(h(App, {
          model
        }), root, cb);
      };
      ReactDOM.render(h(App, {
        model
      }), root);

    }); {
      let isDragging = false;
      document.body.onmousedown = () => {
        isDragging = false;
      };
      document.body.onmousemove = e => {
        if (e.movementX || e.movementY) {
          isDragging = true;
        }
      };
      document.body.onclick = e => {
        if (!e.target.closest("a") && !isDragging) {
          let el = e.target.closest(".quick-select");
          if (el) {
            getSelection().selectAllChildren(el);
          }
        }
      };
    }
  }
};