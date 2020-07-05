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

function createDom(fiber){
  const dom =
  fiber.type === "TEXT_ELEMENT"
    ? document.createTextNode("")
    : document.createElement(fiber.type)

  updateDom(dom, {}, fiber.props)

  return dom
}

const isEvent = key => key.startsWith('on')
const isProperty = key => key !== "children" && !isEvent(key);
const isNew = (prev,next) => key => prev[key] !== next[key]
const isGone = (prev, next) => key => !(key in next)


function updateDom(dom, prevProps, nextProps){
  Object.keys(prevProps)
    .filter(isEvent)
    .filter(
      key => 
        !(key in prevProps) || isNew(prevProps, nextProps)(key)
    )
    .forEach(name => {
      const eventType = name.toLowerCase().substring(2)
      dom.removeEventListener(eventType,prevProps[name])
    })

  Object.keys(prevProps)
    .filter(isProperty)
    .filter(isGone(prevProps, nextProps))
    .forEach(name => {
      dom[name] = ''
    })
  Object.keys(nextProps)
    .filter(isProperty)
    .filter(isNew(prevProps, nextProps))
    .forEach(name=>{
      dom[name] = nextProps[name]
    })

  Object.keys(nextProps)
    .filter(isEvent)
    .filter(isNew(prevProps, nextProps))
    .forEach(name=>{
      const eventType = name.toLowerCase().substring(2)
      dom.addEventListener(eventType, nextProps[name])
    })
}

function commitRoot(){
  deletions.forEach(commitWork)
  commitWork(wipRoot.child)
  currentRoot = wipRoot
  wipRoot = null
}

function commitWork(fiber){
  if(!fiber) return;
  let domParentFiber = fiber.parent
  while(!domParentFiber.dom){
    domParentFiber = domParentFiber.parent
  }

  const domParent = domParentFiber.dom
  if(fiber.effectTag === 'PLACEMENT' && fiber.dom !== null) {
    domParent.appendChild(fiber.dom)
  } else if(fiber.effectTag === 'UPDATE' && fiber.dom !== null) {
    updateDom(fiber.dom, fiber.alternate.props, fiber.props)
  } else if(fiber.effectTag === 'DELETION'){
    commitDeletion(fiber, domParent)
  } 

  commitWork(fiber.child)
  commitWork(fiber.sibling)
}

function commitDeletion(fiber, domParent){
  if(fiber.dom){
    domParent.removeChild(fiber.dom)
  } else {
    commitDeletion(fiber.child, domParent)
  }
}

function render(element, container) {
  wipRoot = {
    dom: container,
    props: {
      children: [element]
    },
    alternate: currentRoot
  }
  deletions = []
  nextUnitOfWork = wipRoot 
}

// // 拆分成小任务 完成每个小任务后 暂停渲染 把控制权交给浏览器让浏览器处理一些高优先级任务

let nextUnitOfWork = null
let wipRoot = null
let currentRoot = null
let deletions = null

function workLoop(deadline){
  let shouldYeild = false
  while(nextUnitOfWork && !shouldYeild) {
    nextUnitOfWork = performUnitOfWork(nextUnitOfWork)
    shouldYeild = deadline.timeRemaining() < 1
  }
  if(!nextUnitOfWork && wipRoot){
    commitRoot()
  }
  requestIdleCallback(workLoop)
}

requestIdleCallback(workLoop)

let wipFiber = null
let hookIndex = null

function updateFunctionComponent(fiber){
  wipFiber = fiber
  hookIndex = 0
  wipFiber.hooks = []
  const children = [fiber.type(fiber.props)]
  reconcileChildren(fiber, children)
}

function useState(initial){
  const oldHook = wipFiber.alternate && wipFiber.alternate.hooks && wipFiber.alternate.hooks[hookIndex]
  const hook = {
    state: oldHook ? oldHook.state : initial,
    queue: []
  }

  const actions = oldHook ? oldHook.queue : []
  actions.forEach(action => {
    hook.state = action(hook.state)
  })
  const setState = action => {
    hook.queue.push(action)
    wipRoot = {
      dom: currentRoot.dom,
      props: currentRoot.props,
      alternate: currentRoot
    }
    nextUnitOfWork = wipRoot
    deletions = []
  }

  wipFiber.hooks.push(hook)
  hookIndex++
  return [hook.state, setState]
}

function updateHostComponent(fiber){
  if(!fiber.dom) {
      fiber.dom = createDom(fiber)
    }
  const elements = fiber.props.children
  reconcileChildren(fiber, elements)
}

function performUnitOfWork(fiber){
  const isFunctionComponent = fiber.type instanceof Function
  if(isFunctionComponent){
    updateFunctionComponent(fiber)
  } else {
    updateHostComponent(fiber)
  }
  if(fiber.child) {
    return fiber.child
  }
  let nextFiber = fiber
  while(nextFiber){
    if(nextFiber.sibling) {
      return nextFiber.sibling
    }
    nextFiber = nextFiber.parent
  }
}

function reconcileChildren(wipFiber, elements){
  let index = 0
  let oldFiber = wipFiber.alternate && wipFiber.alternate.child
  let prevSibling = null

  while(index < elements.length || oldFiber != null){
    const element = elements[index]
    let newFiber = null

    const sameType = oldFiber && element && element.type === oldFiber.type

    if(sameType){
      newFiber = {
        type: oldFiber.type,
        props: element.props,
        dom: oldFiber.dom,
        parent: wipFiber,
        alternate: oldFiber,
        effectTag: 'UPDATE'
      }
    }

    if(element && !sameType) {
      newFiber = {
        type: element.type,
        props: element.props,
        dom: null,
        parent: wipFiber,
        alternate: null,
        effectTag: 'PLACEMENT'
      }
    }

    if(oldFiber && !sameType) {
      oldFiber.effectTag = 'DELETION'
      deletions.push(oldFiber)
    }

    if(oldFiber) {
      oldFiber = oldFiber.sibling
    }

    if(index === 0){
      wipFiber.child = newFiber
    } else {
      prevSibling.sibling = newFiber
    }
    prevSibling = newFiber
    index++
  }
}

const MiniReact = {
  createElement,
  render,
  useState
}
// babel转译时使用自定义的createElement 而不是React默认的
/** @jsx MiniReact.createElement */
// const element = (
//   <div style="background: salmon">
//     <h1>Hello World</h1>
//     <h2 style="text-align:right">from MiniReact</h2>
//   </div>
// );


function Counter() {
  const [state, setState] = MiniReact.useState(1)
  return (
    <h1 onClick={() => setState(c => c + 1)}>
      Count: {state}
    </h1>
  )
}
const element = <Counter />
const container = document.getElementById('root')
MiniReact.render(element, container);


