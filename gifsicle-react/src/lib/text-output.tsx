import {PureComponent} from "react";
import * as React from "react";

interface  myProps {
    stdOutLines: string[];
    stdErrLines: string[];
}
export class TextOutput extends PureComponent<myProps> {
    render() {
        return (
            <div className={'text-output-container'}>
                <div className={'stdout-container terminal-card'}>
                    <header>StdOut</header>
                    {this.props.stdOutLines.reverse().map(l => <div key={l}>{l}</div>)}
                </div>
                <div className={'stderr-container terminal-card'}>
                    <header>StdErr</header>
                    {this.props.stdErrLines.reverse().map(l => <div key={l}>{l}</div>)}
                </div>
            </div>

        )
    }
}
