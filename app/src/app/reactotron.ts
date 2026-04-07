/* eslint-disable import/no-extraneous-dependencies */
import { NativeModules } from 'react-native'
import Reactotron, { trackGlobalErrors } from 'reactotron-react-native'
import { reactotronRedux } from 'reactotron-redux'

function getHostObj() {
  try {
    const host = NativeModules.SourceCode.scriptURL
      .split('://')[1]
      .split(':')[0]

    return { host }
  } catch (err) {
    return {}
  }
}

const reactotron = Reactotron.configure(getHostObj())
  .useReactNative()
  .use(trackGlobalErrors({}))
  .use(reactotronRedux())
  .connect()

/*if (__DEV__) {
  /* eslint-disable no-console 
  const oldConsoleLog = console.log
  console.log = (...args) => {
    oldConsoleLog(...args);

    Reactotron.display({
        name: 'CONSOLE.LOG',
        value: args,
        preview: args.length > 0 && typeof args[0] === 'string' ? args[0] : null,
    });
  }
}*/

export default reactotron
