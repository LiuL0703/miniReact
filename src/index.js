function createElement(type, props, ...children){
  return {
    type,
    props: {
      ...props,
      children: children.map(child => typeof child === 'object' ? child : createTextElement(child))
    }
  }
}

function createTextElement(text) {
  return {
    type: "TEXT_ELEMENT",
    props: {
      nodeValue: text,
      children: []
    }
  };
}

function render(element, container){
  const dom = element.type === 'TEXT_ELEMENT' 
    ? document.createTextNode("") 
    : document.createElement(element.type)

  const isProperty = key => key !== "children";
  Object.keys(element.props).filter(isProperty).forEach(name => {
    dom[name] = element.props[name]
  }) 

  element.props.children.forEach(child => render(child, dom))
  container.appendChild(dom)
}

const MiniReact = {
  createElement,
  render
}
// babel转译时使用自定义的createElement 而不是React默认的
/** @jsx MiniReact.createElement */
const element = (
  <div style="background: salmon">
    <h1>Hello World</h1>
    <h2 style="text-align:right">from MiniReact</h2>
  </div>
);

const container = document.getElementById('root')
MiniReact.render(element, container);






