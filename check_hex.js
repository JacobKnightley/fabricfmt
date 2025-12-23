import SqlBaseLexer from './dist/generated/SqlBaseLexer.js';
import antlr4 from 'antlr4';

const sql = "SELECT X'1234' FROM t";
const chars = new antlr4.InputStream(sql);
const lexer = new SqlBaseLexer(chars);
const tokens = new antlr4.CommonTokenStream(lexer);
tokens.fill();

console.log('Tokens:');
for (const token of tokens.tokens) {
    if (token.type !== antlr4.Token.EOF && token.type !== SqlBaseLexer.WS) {
        const symbolicName = SqlBaseLexer.symbolicNames[token.type];
        console.log(`  ${symbolicName}: "${token.text}"`);
    }
}
