
// This is a simplified mock implementation of GenSX for frontend demonstration
export type ComponentFn<Props, Output> = (props: Props) => Promise<Output>;

export type Component<Props, Output> = ComponentFn<Props, Output>;

class GenSX {
  Component<Props, Output>(fn: ComponentFn<Props, Output>): Component<Props, Output> {
    return async (props: Props): Promise<Output> => {
      return await fn(props);
    };
  }
}

const gensx = new GenSX();
export default gensx;
