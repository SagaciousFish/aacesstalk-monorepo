// Webpack alias for _jsxRuntime to fix module resolution
import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from 'react';

module.exports = {
  jsx: _jsx,
  jsxs: _jsxs,
  Fragment: _Fragment,
  jsxDEV: _jsx,
};

export default {
  jsx: _jsx,
  jsxs: _jsxs,
  Fragment: _Fragment,
  jsxDEV: _jsx,
};
