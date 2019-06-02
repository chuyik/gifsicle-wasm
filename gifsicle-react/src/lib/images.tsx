import {Component, PureComponent} from "react";
import * as React from "react";
import {bytesToBase64, getImageDimensions, gImage} from "./gifsicle-wrapper";
import {InputImage} from "./input-image";
import {OutputImage} from "./output-image";

export function ReadDroppedFile(file: File): Promise<Uint8Array> {
    return new Promise((resolve) => {
        const r = new FileReader();
        r.onload = e => {
            // @ts-ignore
            resolve(e.target.result)
        };
        r.readAsArrayBuffer(file);
    });
}

interface myProps {
    inputImages: gImage[];
    outputImages: gImage[];
    imageClose: (i: gImage) => void
    imageOpen: (i: gImage) => void
}

class myState {
    draggedOver: boolean = false;
}

export class Images extends Component<myProps> {
    state: myState;

    constructor(props: Readonly<myProps>) {
        super(props);
        this.state = new myState();
    }

    handleDragOver(event: React.DragEvent<HTMLDivElement>) {
        event.preventDefault();
        return;
    }

    handleFileUpload(event: React.ChangeEvent<HTMLInputElement>) {
        for (let i = 0; i < (event.target.files ? event.target.files.length : 0); i++) {
            const file = event.target.files && event.target.files[i];
            if (file === null) continue;
            this.extracted(file);
        }
    }
    handleDrop(event: React.DragEvent<HTMLDivElement>) {
        (async () => {
            event.preventDefault();
            if (!event.dataTransfer || !event.dataTransfer.files) {
                return;
            }
            const files = event.dataTransfer.files;
            const l = files.length;
            for (let i = 0; i < l; i++) {
                const file = files[i];
                await this.extracted(file);
            }
        })();
    }

    private async extracted(file: File) {
        const bytes = await ReadDroppedFile(file);
        const base64 = await bytesToBase64(bytes);
        this.props.imageOpen({
            name: file.name,
            base64: base64,
            size: await getImageDimensions(base64),
            data: bytes,
        });
    }

    render() {
        return (
            <div className={'images-container'}>
                <div className={'input-images-container terminal-card'}
                     onDragOver={this.handleDragOver}
                     onDrop={e => {
                         this.setState({draggedOver: false});
                         this.handleDrop(e);
                     }
                     }
                     onDragEnter={() => this.setState({draggedOver: true})}
                     onDragLeave={() => this.setState({draggedOver: false})}
                >
                    <header className={this.state.draggedOver ? 'dragover' : ''}>
                        <span>Input Image &nbsp;</span>
                        <input type={'file'}
                               onChange={e => this.handleFileUpload(e)}
                               accept="image/gif"
                        />
                    </header>
                    {this.props.inputImages.map(i => <InputImage key={i.name} image={i}
                                                                 close={this.props.imageClose}/>)}
                </div>
                <div className={'output-images=container terminal-card'}>
                    <header>Output Image</header>
                    {this.props.outputImages.map(i => <OutputImage key={i.name} image={i}/>)}
                </div>
            </div>

        )
    }
}
