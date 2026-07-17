import {Container} from 'unstated';
import kap from '../utils/kap';

export default class ConfigContainer extends Container {
  state = {selectedTab: 0};

  setPlugin = async pluginName => {
    this.pluginName = pluginName;
    const config = await kap.pluginConfig.load({pluginName});
    this.validators = config.validators;
    this.setState({
      validators: this.validators,
      values: config.values,
      pluginName
    });
  };

  setEditService = async (pluginName, serviceTitle) => {
    this.pluginName = pluginName;
    this.serviceTitle = serviceTitle;
    const config = await kap.pluginConfig.load({pluginName, serviceTitle});
    this.validators = config.validators;
    this.setState({
      validators: this.validators,
      values: config.values,
      pluginName,
      serviceTitle
    });
  };

  closeWindow = () => kap.window.close();

  openConfig = () => kap.pluginConfig.openInEditor(this.pluginName);

  viewOnGithub = () => kap.pluginConfig.viewOnGithub(this.pluginName);

  onChange = async (key, value) => {
    const config = value === undefined ?
      await kap.pluginConfig.delete({pluginName: this.pluginName, key}) :
      await kap.pluginConfig.set({pluginName: this.pluginName, key, value});

    const filteredValidators = this.serviceTitle ?
      config.validators.filter(({title}) => title === this.serviceTitle) :
      config.validators;

    this.validators = filteredValidators;
    this.setState({values: config.values, validators: filteredValidators});
  };

  selectTab = selectedTab => {
    this.setState({selectedTab});
  };
}
