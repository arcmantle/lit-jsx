// Test function component for import resolution


export const MyFunctionComponent = (props: { message: string; }): string => {
	return `<div>${ props.message }</div>`;
};
