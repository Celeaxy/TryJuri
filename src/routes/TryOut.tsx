import { ChangeEvent, KeyboardEvent, useState, ReactNode, useEffect, useCallback, useRef, RefObject } from 'react';
import '../style/App.scss';
import { Button, TextField, CircularProgress } from '@mui/material';
import { Theme } from '@mui/material';
import axios from 'axios';
import Highlighter from '../util/Highlighter';
import { CSSProperties } from 'react';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import base64url from 'base64url';
import { useResizeDetector } from 'react-resize-detector';
(window as any).global = window;
// @ts-ignore
window.Buffer = window.Buffer || require('buffer').Buffer;



export default function TryOut({ theme }: { theme?: Theme }) {
  let [code, setCode] = useState(localStorage.getItem('code') || '');
  let [output, setOutput] = useState('');

  let [loading, setLoading] = useState(false);

  let handleRun = function () {
    if (!code) {
      setOutput('');
      return;
    }
    let encoded = base64url(code);

    setLoading(true);
    axios.get('https://juri-online-compiler.herokuapp.com/jurii?code=' + encoded)
      .then(res => setOutput(output + res.data.standard + res.data.error))
      .catch(err => setOutput(output + err))
      .finally(() =>{
        setLoading(false)
        let out = document.getElementById('out')!;
        out.scrollTop = out?.scrollHeight || 0; 
      });

    
    /*axios.get('https://icanhazdadjoke.com/search?term=' + code, { headers: { 'Accept': 'application/json' } })
      .then(res => setOutput(res.data.results.map((r: DadJokesResult) => r.joke).join('\n\n')))
      .catch(err => setOutput(err));*/
  }

  return (
    <div className="TryOut">
      <h1 style={{ fontSize: '36pt' }}>try juri</h1>
      <div>
        <Editor callback={setCode} />
        <TextField id='out' label='Output' multiline margin='normal' variant='outlined' style={{ width: '40%', minWidth: '400px', margin: '2%' }} rows='25' value={output} disabled />
      </div>
      <Button variant='contained' onClick={handleRun} style={{ fontSize: '20px' }}>
        {loading ? <CircularProgress size='1.7em' /> : <><PlayArrowIcon fontSize='large' />Run</>}</Button>
    </div>

  );
}

declare interface editorProps {
  callback: Function,
  autoFocus?: boolean
}

function Editor({ callback, autoFocus }: editorProps) {

  let [highlighted, setHighlighted] = useState(localStorage.getItem('code') && <>{highlight(localStorage.getItem('code')!)}</> || <></>);
  let [text, setText] = useState(localStorage.getItem('code') || '');
  let [scrolling, setScrolling] = useState(0);
  let handleChange = function (event: ChangeEvent<HTMLTextAreaElement>) {
    if (event.target.value !== text) {
      localStorage.setItem('code', event.target.value);
      setText(event.target.value);
      callback(event.target.value);
      setHighlighted(<>{highlight(event.target.value)}</>);
    }
  }
  let editor = useRef<HTMLDivElement>(null);
  let handleKeyPress = function (event: KeyboardEvent<HTMLDivElement>) {
    let t = event.target as HTMLTextAreaElement;
    let tab = '    ';
    let cpos = t.selectionStart;
    let insert = function (text: string) {
      t.value = t.value.slice(0, cpos) + text + t.value.slice(cpos);
    }
    let currentRow = () => {
      let rows = t.value.slice(0, cpos).split('\n');
      return rows[rows.length - 1];
    }
    switch (event.key) {
      case 'Tab':
        event.preventDefault();
        insert(tab);
        t.setSelectionRange(cpos + 4, cpos + 4);
        break;
      case 'Enter':
        event.preventDefault();
        let matches = currentRow().match(/^( {4})+/);
        let spaces = 0;
        if (matches) {
          spaces = matches[0].length;
        }
        if (currentRow().match(/^\s*(if|fun|operator|:\w+\s*=\s*init\s+\.+\s+as\s+\w+\.*|iterate\s+.+\sas\s+.+)/)) {
          spaces += 4;
        }
        insert('\n' + ' '.repeat(spaces));
        t.setSelectionRange(cpos + spaces + 1, cpos + spaces + 1);
        break;
      case 'Backspace':
        if (t.selectionStart === t.selectionEnd && currentRow().match(/ {4}$/)) {
          event.preventDefault();
          t.value = t.value.slice(0, cpos - 4) + t.value.slice(cpos);
          t.setSelectionRange(cpos - 4, cpos - 4);
        }
        break;
    }
    //t.dispatchEvent(new Event('change'));
    handleChange({ target: { name: t.name, value: t.value } } as ChangeEvent<HTMLTextAreaElement>);
  }
  const handleScroll = useCallback(event => {
    setScrolling(event.target.scrollTop || 0);
  }, []);

  useEffect(() => {
    let editor = document.getElementById('editor')!;
    editor.addEventListener("scroll", handleScroll);
    return () => {
      editor.removeEventListener("scroll", handleScroll);
    };
  }, [handleScroll]);

  useEffect(() => {

  }, [(document.getElementById('editor') as HTMLTextAreaElement)?.value]);
  return <>
    <TextField sx={{ color: 'transparent !important' }} ref={editor} id='editor' placeholder='Please enter your code here.' onScroll={handleScroll} onKeyDown={handleKeyPress} inputProps={{ spellCheck: 'false' }} autoFocus={autoFocus} multiline onChange={handleChange} margin='normal' variant='outlined' style={{ width: '40%', minWidth: '400px', margin: '2%' }} rows='25' value={text} />
    <DivOverlay elementID={'editor'} scrolling={scrolling} targetRef={editor}>{highlighted}</DivOverlay>
  </>
}


function highlight(text: string) {
  const keywords = { regex: /^(fun|repeat|operator|init|as|iterate|return|break|then)$/, color: 'rgb(0,200,255' };
  const separators = { regex: /[()[\]]/, color: 'rgb(200,200,240)' };
  const numbers = { regex: /\d+/, color: 'rgb(230,255,200)' };
  const lists = { regex: /:[A-Za-z]\w*/, color: 'rgb(255,200,120)' };
  const operators = { regex: /[+\-*/><.=!%|&]/, color: 'rgb(100,255,255)' };
  const comments = { regex: /#.*/, color: 'rgb(150,150,150)' }
  const hl = new Highlighter(
    { regex: /if/, color: 'rgb(255,100,80)' },
    keywords,
    separators,
    numbers,
    lists,
    operators,
    comments
  );

  return hl.highlight(text);
}

function DivOverlay({ elementID, children, scrolling, targetRef }: { elementID: string, children: ReactNode, scrolling: number, targetRef: RefObject<HTMLDivElement> }) {
  let [style, setStyle] = useState({
    width: '0',
    height: '0',
    maxWidth: '0',
    maxHeight: '0',
    pointerEvents: 'none',
    position: 'absolute',
    textAlign: 'left',
    lineHeight: '1.4375em',
    // border: '2px solid red',
    color: 'white',
    top: 0,
    left: 0,
    overflowY: 'clip',
    whiteSpace: 'pre-wrap'

  } as CSSProperties);

  const onResize = useCallback(() => {
    updateStyle();
  }, []);
  const { width, height } = useResizeDetector({ targetRef, onResize });

  let updateStyle = function () {
    let element = document.getElementById(elementID)!;
    let compStyle = getComputedStyle(element);
    let rect = element.getBoundingClientRect();
    setStyle({
      ...style,
      width: compStyle.width,
      maxWidth: compStyle.width,
      height: compStyle.height,
      maxHeight: compStyle.height,
      top: rect.top + window.scrollY,
      left: rect.left + window.scrollX
    } as CSSProperties);
  }

  window.onscroll = updateStyle;
  window.onresize = updateStyle;
  window.onload = updateStyle;

  useEffect(() => {
    updateStyle();
  }, [(document.getElementById(elementID) && (getComputedStyle(document.getElementById(elementID)!).top, getComputedStyle(document.getElementById(elementID)!).left))]);

  return <div style={style}><div className='highlighting' style={{ transform: `translateY(${-scrolling}px)` }}>{children}</div></div>
}
