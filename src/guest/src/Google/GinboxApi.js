const escapeHTML = require('escape-html')
const { remote } = require('electron')

class GinboxApi {
  /**
  * @return true if the API is ready
  */
  static isReady () { return document.readyState === 'complete' }

  /**
  * Gets the visible unread count. Ensures that clusters are only counted once/
  * May throw a dom exception if things go wrong
  * @return the unread count
  */
  static getVisibleUnreadCount () {
    const unread = Array.from(document.querySelectorAll('[data-item-id] [email]')).reduce((acc, elm) => {
      const isUnread = elm.tagName !== 'IMG' && window.getComputedStyle(elm).fontWeight === 'bold'
      if (isUnread) {
        const clusterElm = elm.closest('[data-item-id^="#clusters"]')
        if (clusterElm) {
          acc.openClusters.add(clusterElm)
        } else {
          acc.messages.add(elm)
        }
      }
      return acc
    }, { messages: new Set(), openClusters: new Set() })
    return unread.messages.size + unread.openClusters.size
  }

  /**
  * Checks if the inbox tab is visble
  * May throw a dom exception if things go wrong
  * @return true or false
  */
  static isInboxTabVisible () {
    const elm = document.querySelector('nav [role="menuitem"]') // The first item
    return window.getComputedStyle(elm).backgroundColor.substr(-4) !== ', 0)'
  }

  /**
  * Checks if the pinned setting is toggled
  * May throw a dom exception if things go wrong
  * @return true or false
  */
  static isInboxPinnedToggled () {
    const elm = document.querySelector('[jsaction="global.toggle_pinned"]')
    return elm ? elm.getAttribute('aria-pressed') === 'true' : false
  }

  /**
  * Handles opening the compose ui and prefills relevant items
  * @param data: the data that was sent with the event
  */
  static composeMessage (data) {
    const composeButton = document.querySelector('button.y.hC') || document.querySelector('[jsaction="jsl._"]')
    if (!composeButton) { return }
    composeButton.click()

    setTimeout(() => {
      // Grab elements
      const bodyEl = document.querySelector('[g_editable="true"][role="textbox"]')
      if (!bodyEl) { return }
      const dialogEl = bodyEl.closest('[role="dialog"]')
      if (!dialogEl) { return }
      const recipientEl = dialogEl.querySelector('input') // first input
      const subjectEl = dialogEl.querySelector('[jsaction*="subject"]')
      let focusableEl

      // Recipient
      if (data.recipient && recipientEl) {
        recipientEl.value = escapeHTML(data.recipient)
        focusableEl = subjectEl
      }

      // Subject
      if (data.subject && subjectEl) {
        subjectEl.value = escapeHTML(data.subject)
        focusableEl = bodyEl
      }

      // Body
      if (data.body && bodyEl) {
        bodyEl.innerHTML = escapeHTML(data.body) + bodyEl.innerHTML
        const labelEl = bodyEl.parentElement.querySelector('label')
        if (labelEl) { labelEl.style.display = 'none' }
        focusableEl = bodyEl
      }

      if (focusableEl) {
        setTimeout(() => focusableEl.focus(), 500)
      }
    })
  }

  /**
  * Starts a search
  * @param term: the term to search for
  */
  static startSearch (term) {
    const element = document.querySelector('[role="search"] input')
    element.value = term

    const evt = new window.Event('input', {
      bubbles: true,
      cancelable: true
    })
    element.dispatchEvent(evt)
  }

  /**
  * Opens the first search item
  * @param timeout=2000: timeout in ms to keep retrying
  * @param retry=100: time to wait between retries
  * @param completeFn=undefined: given when the element is clicked. Provided with true click was a success, false otherwise
  * @return the setInterval timeout. If cancelled cb will not execute
  */
  static openFirstSearchItem (timeout = 2000, retry = 100, completeFn = undefined) {
    const start = new Date().getTime()
    const interval = setInterval(() => {
      if (new Date().getTime() > start + timeout) {
        clearInterval(interval)
        if (completeFn) { completeFn(false) }
      } else {
        const element = document.querySelector('[jsaction*="search.toggle_item"]')
        if (element) {
          clearInterval(interval)
          const rect = element.getBoundingClientRect()
          const wc = remote.getCurrentWebContents()
          wc.sendInputEvent({
            type: 'mouseDown',
            x: rect.left + 1,
            y: rect.top + 1,
            button: 'left',
            clickCount: 1
          })
          wc.sendInputEvent({
            type: 'mouseUp',
            x: rect.left + 1,
            y: rect.top + 1,
            button: 'left',
            clickCount: 1
          })
          if (completeFn) { completeFn(true) }
        }
      }
    }, retry)
    return interval
  }
}

module.exports = GinboxApi
