export class CommandManager {
  constructor(onChange = () => {}) {
    this.undoStack = [];
    this.redoStack = [];
    this.maxHistory = 100;
    this.onChange = onChange;
  }

  execute(command) {
    command.execute();
    this.undoStack.push(command);
    this.redoStack = [];
    if (this.undoStack.length > this.maxHistory) this.undoStack.shift();
    this.onChange();
  }

  commitExecuted(command) {
    this.undoStack.push(command);
    this.redoStack = [];
    if (this.undoStack.length > this.maxHistory) this.undoStack.shift();
    this.onChange();
  }

  undo() {
    const command = this.undoStack.pop();
    if (!command) return;
    command.undo();
    this.redoStack.push(command);
    this.onChange();
  }

  redo() {
    const command = this.redoStack.pop();
    if (!command) return;
    command.execute();
    this.undoStack.push(command);
    this.onChange();
  }

  clear() {
    this.undoStack = [];
    this.redoStack = [];
    this.onChange();
  }
}
