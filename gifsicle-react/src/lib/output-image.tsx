import {PureComponent} from "react";
import * as React from "react";
import {gImage} from "./things";
import {InputImage} from "./input-image";


interface myProps {
    image: gImage;
}
export class OutputImage extends PureComponent<myProps> {
    render() {
        return (
            <div className={'input-image'}>
                <span>{this.props.image.name}&nbsp;{InputImage.calcSize(this.props.image)}&nbsp;{this.props.image.size.x}x{this.props.image.size.y}&nbsp;</span>
{/*                <a href={this.props.image.base64} download={this.props.image.name}>Download</a>*/}
                <img src={this.props.image.base64}/>
            </div>
        )
    }
}
