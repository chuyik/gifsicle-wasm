import {Component, PureComponent} from "react";
import * as React from "react";
import {gImage} from "./gifsicle-wrapper";


interface myProps {
    image: gImage;
    close: (i: gImage) => void
}
export class InputImage extends PureComponent<myProps> {
    calcSize(i: gImage) {
        const y = i.name.endsWith('==') ?
            2 : 1;
        return `${((i.base64.length * (3/4)) - y) / 1000000}mb`;
    }
    render() {
        return (
            <div className={'input-image'}>
                <span>{this.props.image.name}&nbsp;{this.calcSize(this.props.image)}&nbsp;</span>
                <a onClick={e => this.props.close(this.props.image)}>close</a>
{/*                <button className={'btn btn-default'} >X</button>*/}
                <img src={this.props.image.base64}/>
            </div>
        )
    }
}
