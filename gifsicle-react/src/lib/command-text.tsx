import {PureComponent} from "react";
import * as React from "react";


interface myProps {
    readOnlyText: string;
    editableText: string;
    onTextChange: (s: string) => void
}
export class CommandText extends PureComponent<myProps> {
    render() {
        return (
            <div className={"command-text terminal-card form-group"}>
                <header>Terminal Input</header>
                <form>
                    <div className={'form-group'}>
                        <label>Commands</label>
                        <input type={'text'} value={this.props.editableText} onChange={e => this.props.onTextChange(e.target.value)}/>
                    </div>
                    <div className={'form-group'}>
                        <label>Final Command</label>
                        <input type={'text'} value={this.props.readOnlyText} readOnly={true}/>
                    </div>
                </form>
            </div>
        )
    }
}
