declare module 'troika-three-text' {
  export * from 'troika-types/packages/troika-three-text/dist/src/index';
}

interface Window {
  SpeechRecognition?: any;
  webkitSpeechRecognition?: any;
}
