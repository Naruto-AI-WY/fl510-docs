window.MathJax = {
  tex: {
    inlineMath: [["\\(", "\\)"], ["$", "$"]],
    displayMath: [["\\[", "\\]"], ["$$", "$$"]],
    processEscapes: true,
    processEnvironments: true,
    packages: {'[+]': ['ams', 'newcommand', 'configmacros']}
  },
  options: {
    ignoreHtmlClass: "tex2jax_ignore",
    processHtmlClass: "tex2jax_process"
  },
  startup: {
    ready: function () {
      MathJax.startup.defaultReady();
      console.log('MathJax is loaded, but not yet initialized');
    }
  }
};
