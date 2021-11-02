import { Component } from "preact";

export default class StaticBoundary extends Component {
  shouldComponentUpdate() {
    return false;
  }

  render() {
    return this.props.children;
  }
}