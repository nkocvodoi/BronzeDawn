// The one rules file, shared with the Mac build and checked by balance.py.
import file from "../../../data/rules.json";
import { Rules, RulesFile } from "./rules";

export const RULES = new Rules(file as unknown as RulesFile);
